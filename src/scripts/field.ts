/**
 * The living gradient field — cheap by design.
 *
 * The field is soft and blurry by nature, so it is rendered into a TINY canvas
 * (≈ 1/4 of CSS pixels by default) and the browser stretches it to the viewport.
 * One draw call, no framebuffers, a few dozen thousand pixels per frame: it keeps
 * running during scroll (palette + flow never freeze) and leaves the GPU to page content.
 *
 * Film grain is NOT here: see ./grain.ts (a static noise canvas moved by the compositor).
 *
 * Scroll = time of day: every element in <body> with [data-daytime] anchors a palette at
 * its centre; between two anchors the palette blends, so the day drifts as you read.
 *
 * Tunables: ./bg.ts (`bgDefaults`, per-tier overrides), live in the dev toolbar.
 * Reduced motion: one static frame, re-rendered only when the palette changes.
 * No WebGL / context lost: CSS gradient fallback driven by the same palette (CSS vars).
 */
import { daytimes, hexToRgb, type Daytime } from '~/lib/palette';
import { bg, onBg } from './bg';
import { motion } from './motion';

type RGB = [number, number, number];
type Pal = [RGB, RGB, RGB, RGB, RGB];

const toPal = (d: Daytime): Pal => daytimes[d].map((h) => hexToRgb(h).map((c) => c / 255) as RGB) as Pal;
const PALS = Object.fromEntries(Object.keys(daytimes).map((k) => [k, toPal(k as Daytime)])) as Record<Daytime, Pal>;

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC[5];
uniform vec3 uPtr;     // xy: pointer in uv (y up), z: strength 0..1
uniform float uScale;  // noise zoom
uniform float uWarp;   // domain-warp strength
uniform float uDetail; // fbm octaves 1..6
uniform float uHalo;   // halo mix
uniform float uRipple; // pointer ripple multiplier
uniform float uGrad;   // 1 = gradient noise, 0 = value noise

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
// random unit-ish gradient per lattice point (Hoskins hash22, fract-only: stable on mobile GPUs)
vec2 grad(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.xx+p3.yz)*p3.zy)*2.-1.;
}
// Value noise interpolates random VALUES → the grid shows through as facets once domain-warped.
// Gradient noise interpolates random SLOPES with a quintic curve (C2-continuous) → no creases.
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  if(uGrad>.5){
    vec2 u=f*f*f*(f*(f*6.-15.)+10.);
    float a=dot(grad(i),f);
    float b=dot(grad(i+vec2(1.,0.)),f-vec2(1.,0.));
    float c=dot(grad(i+vec2(0.,1.)),f-vec2(0.,1.));
    float d=dot(grad(i+vec2(1.,1.)),f-vec2(1.,1.));
    // gradient noise is centred on 0 with a narrower spread: map it onto value noise's 0..1 range
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*.85+.5;
  }
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y);
}
float fbm(vec2 p){
  float v=0., a=.5;
  mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<6;i++){ if(float(i)>=uDetail) break; v+=a*noise(p); p=m*p; a*=.5; }
  // keep the overall range stable when octaves change
  return v/(1.-pow(.5,uDetail))*.97;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 asp=vec2(uRes.x/uRes.y,1.);
  vec2 p=(uv-.5)*asp*uScale;

  // gentle ripple near the pointer
  vec2 d=p-(uPtr.xy-.5)*asp*uScale;
  float r=length(d);
  p+=(d/max(r,1e-3))*sin(r*16.-uTime*2.)*.02*uRipple*uPtr.z*exp(-r*3.2);

  float t=uTime*.04;
  vec2 q=vec2(fbm(p+vec2(0.,t)), fbm(p+vec2(5.2,1.3)-t*.8));
  vec2 w=vec2(fbm(p+3.*uWarp*q+vec2(1.7,9.2)+t*.6), fbm(p+3.*uWarp*q+vec2(8.3,2.8)-t*.5));
  float f=fbm(p+2.4*uWarp*w);

  vec3 col=mix(uC[0],uC[1],smoothstep(.22,.62,f));
  col=mix(col,uC[2],smoothstep(.45,.95,length(q))*.8);
  col=mix(col,uC[3],smoothstep(.48,.74,w.x)*.92);
  // defocused halo: the soft bright glow around blurred shapes
  float h=smoothstep(.5,.82,f*.55+w.y*.6);
  col=mix(col,uC[4],h*uHalo);
  gl_FragColor=vec4(col,1.);
}`;

export function initField(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.field__canvas');
  const anchors = () => Array.from(document.querySelectorAll<HTMLElement>('body [data-daytime]'));

  // ── palette state ──
  const first = (anchors()[0]?.dataset.daytime as Daytime | undefined) ?? 'sea';
  const cur: Pal = structuredClone(PALS[first] ?? PALS.sea);
  let target: Pal = structuredClone(cur);
  let locked: Daytime | null = null;

  const mixPal = (a: Pal, b: Pal, k: number): Pal => a.map((c, i) => c.map((v, j) => v + ((b[i]![j] ?? 0) - v) * k)) as Pal;

  function computeTarget(): void {
    if (locked) {
      target = PALS[locked];
      return;
    }
    const els = anchors();
    if (!els.length) return;
    const yc = innerHeight * 0.5;
    const centres = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { c: r.top + r.height / 2, d: (el.dataset.daytime as Daytime) ?? 'sea' };
    });
    let a = centres[0]!, b = centres[0]!;
    if (yc > a.c) {
      a = centres[centres.length - 1]!;
      b = a;
      for (let i = 0; i < centres.length - 1; i++) {
        if (yc >= centres[i]!.c && yc < centres[i + 1]!.c) {
          a = centres[i]!;
          b = centres[i + 1]!;
          break;
        }
      }
    }
    const span = b.c - a.c;
    const k0 = span > 0 ? (yc - a.c) / span : 0;
    const k = k0 * k0 * (3 - 2 * k0);
    target = mixPal(PALS[a.d] ?? PALS.sea, PALS[b.d] ?? PALS.sea, k);
    const nearest = k < 0.5 ? a.d : b.d;
    if (document.documentElement.dataset.daytime !== nearest) document.documentElement.dataset.daytime = nearest;
  }

  // ── CSS fallback vars (written only while the fallback is what you see) ──
  let lastCss = 0;
  function writeCss(now: number, force = false): void {
    if (!force && now - lastCss < 120) return;
    lastCss = now;
    cur.forEach((c, i) => root.style.setProperty(`--f${i}`, `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`));
  }

  let scrollDirty = true;
  addEventListener('scroll', () => (scrollDirty = true), { passive: true });
  addEventListener('field:lock', (e) => {
    const d = (e as CustomEvent<Daytime | null>).detail;
    locked = d && d in PALS ? d : null;
    scrollDirty = true;
    kick();
  });

  // ── WebGL: one program, one triangle ──
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas?.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }) ?? null;
  } catch {
    gl = null;
  }
  const prog = gl ? build(gl) : null;
  if (!prog) gl = null;
  root.classList.toggle('field--gl', Boolean(gl));
  writeCss(0, true);

  const U: Record<string, WebGLUniformLocation | null> = {};
  if (gl && prog) {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uTime', 'uC', 'uPtr', 'uScale', 'uWarp', 'uDetail', 'uHalo', 'uRipple', 'uGrad']) U[n] = gl.getUniformLocation(prog, n);
  }

  canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.classList.remove('field--gl', 'field--ready');
    gl = null;
  });

  // ── size: a tiny canvas, stretched by CSS ──
  let w = 0, h = 0;
  function resize(force = false): void {
    if (!gl || !canvas) return;
    const res = bg().resolution;
    const nw = Math.max(16, Math.round(root.clientWidth * res));
    const nh = Math.max(16, Math.round(root.clientHeight * res));
    // ignore the mobile URL bar: small height changes are just stretched
    if (!force && nw === w && Math.abs(nh - h) < Math.max(8, h * 0.2)) return;
    w = canvas.width = nw;
    h = canvas.height = nh;
    gl.viewport(0, 0, w, h);
    window.__bgStats = { dyn: 1, frameMs: 0, fieldPx: `${w}×${h}` };
  }
  addEventListener('resize', () => {
    resize();
    kick();
  });

  // live settings (dev toolbar)
  const applyDom = () => {
    root.classList.toggle('field--off', !bg().fieldOn);
    if (canvas) canvas.style.filter = bg().canvasBlur ? `blur(${bg().canvasBlur}px)` : '';
  };
  applyDom();
  onBg((patch) => {
    applyDom();
    if ('resolution' in patch) resize(true);
    writeCss(0, true);
    kick();
  });

  // ── pointer (fine pointers only) ──
  const ptr = { x: 0.5, y: 0.5, s: 0, ts: 0 };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        ptr.x = e.clientX / innerWidth;
        ptr.y = 1 - e.clientY / innerHeight;
        ptr.ts = 1;
      },
      { passive: true },
    );
  }

  // ── loop ──
  let raf = 0;
  let last = 0;
  let clock = 12; // seconds of shader time (start mid-flow)
  let ready = false;
  const flat = new Float32Array(15);

  function frame(now: number): void {
    raf = 0;
    const c = bg();
    if (!motion.reduced && last && now - last < 1000 / c.fpsCap - 2) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;

    if (scrollDirty) {
      computeTarget();
      scrollDirty = false;
    }
    // ease palette towards target (also smooths anchor jumps)
    const k = motion.reduced ? 1 : 1 - Math.exp(-dt * 2.6);
    let delta = 0;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 3; j++) {
        const d = target[i]![j]! - cur[i]![j]!;
        cur[i]![j]! += d * k;
        delta += Math.abs(d);
        flat[i * 3 + j] = cur[i]![j]!;
      }

    if (!gl || !c.fieldOn) {
      if (delta > 0.002) {
        writeCss(now);
        raf = requestAnimationFrame(frame);
      } else writeCss(now, true);
      return;
    }

    const still = motion.reduced || c.fieldPaused;
    if (!still) clock += dt * c.speed;
    ptr.s += ((ptr.ts ? 1 : 0) - ptr.s) * (1 - Math.exp(-dt * (ptr.ts ? 4 : 1.2)));
    ptr.ts = Math.max(0, ptr.ts - dt * 0.8);

    resize();
    gl.uniform2f(U.uRes!, w, h);
    gl.uniform1f(U.uTime!, clock);
    gl.uniform3fv(U.uC!, flat);
    gl.uniform3f(U.uPtr!, ptr.x, ptr.y, motion.reduced ? 0 : ptr.s);
    gl.uniform1f(U.uScale!, c.scale);
    gl.uniform1f(U.uWarp!, c.warp);
    gl.uniform1f(U.uDetail!, Math.round(c.detail));
    gl.uniform1f(U.uHalo!, c.halo);
    gl.uniform1f(U.uRipple!, c.ripple);
    gl.uniform1f(U.uGrad!, c.gradientNoise ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!ready) {
      ready = true;
      root.classList.add('field--ready');
    }
    if (window.__bgStats) window.__bgStats.frameMs = window.__bgStats.frameMs * 0.9 + (dt * 1000) * 0.1;

    const settled = delta < 0.002 && !scrollDirty;
    if (still && settled && ptr.s < 0.01) return; // static frame
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function kick(): void {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = 0;
      kick();
    }
  });
  addEventListener('scroll', kick, { passive: true });
  motion.onChange(() => kick());
  kick();
}

function build(gl: WebGLRenderingContext): WebGLProgram | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[field] shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = sh(gl.VERTEX_SHADER, VERT);
  const f = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!v || !f) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[field] link:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}
