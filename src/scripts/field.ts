/**
 * The living gradient field: one fixed full-viewport WebGL canvas.
 * Two passes:
 *   1. field  — domain-warped fbm → slow, defocused colour blobs, rendered at LOW resolution
 *               into a texture (it's blurry by nature, so this is cheap and invisible);
 *   2. present — the texture is upscaled to the full-resolution canvas and film grain is added
 *               per canvas pixel, so grain stays crisp and never gets smeared by upscaling.
 * Grain is a 3D hash of (x, y, frame): every grain frame is fresh, uncorrelated noise —
 * not the previous frame shifted — so no lines crawl across the page.
 *
 * Scroll = time of day: every element in <body> with [data-daytime] anchors a palette at its centre;
 * between two anchors the palette blends, so the day drifts as you read.
 *
 * Budget: ~30 fps, canvas ≤ 1.5 DPR, field pass at 0.66 of that, pauses when the tab is hidden.
 * All tunables live in ./bg.ts (`bgDefaults`) and can be changed live from the dev toolbar.
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

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/** pass 2: upscale the field texture + crisp, uncorrelated film grain */
const PRESENT = `${PRECISION}
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uGrain;
uniform float uFrame;
uniform float uGrainSize;
uniform vec2 uTexel;   // 1 / field texture size
uniform float uSoft;   // soft-upsampling radius in field texels (0 = plain bilinear)

// "Hash without Sine" (Dave Hoskins, MIT): no visible structure, time is a real 3rd dimension
float hash13(vec3 p3){
  p3=fract(p3*.1031);
  p3+=dot(p3,p3.zyx+31.32);
  return fract((p3.x+p3.y)*p3.z);
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 col=texture2D(uTex,uv).rgb;
  if(uSoft>0.){
    // 3×3 tent over bilinear taps: a cheap blur that hides the texel grid of a tiny texture
    vec2 o=uTexel*uSoft;
    col=col*.25
      +(texture2D(uTex,uv+vec2(o.x,0.)).rgb+texture2D(uTex,uv-vec2(o.x,0.)).rgb
       +texture2D(uTex,uv+vec2(0.,o.y)).rgb+texture2D(uTex,uv-vec2(0.,o.y)).rgb)*.125
      +(texture2D(uTex,uv+o).rgb+texture2D(uTex,uv-o).rgb
       +texture2D(uTex,uv+vec2(o.x,-o.y)).rgb+texture2D(uTex,uv+vec2(-o.x,o.y)).rgb)*.0625;
  }
  vec2 cell=floor(gl_FragCoord.xy/uGrainSize);
  // triangular distribution (sum of two) reads more like film than flat white noise
  float n=hash13(vec3(cell,uFrame))+hash13(vec3(cell+71.3,uFrame+19.7))-1.;
  col+=n*.7*uGrain;
  gl_FragColor=vec4(col,1.);
}`;

/** pass 1: the field itself, no grain */
const FIELD = `${PRECISION}
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
  const canvas = root.querySelector('canvas');
  const anchors = () => Array.from(document.querySelectorAll<HTMLElement>('body [data-daytime]'));

  // ── palette state ──
  const first = (anchors()[0]?.dataset.daytime as Daytime | undefined) ?? 'sea';
  const cur: Pal = structuredClone(PALS[first] ?? PALS.sea);
  let target: Pal = structuredClone(cur);
  let locked: Daytime | null = null;
  let nearest: Daytime = first;

  const mixPal = (a: Pal, b: Pal, k: number): Pal => a.map((c, i) => c.map((v, j) => v + ((b[i]![j] ?? 0) - v) * k)) as Pal;

  function computeTarget(): void {
    if (locked) {
      target = PALS[locked];
      nearest = locked;
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
    if (yc <= a.c) b = a;
    else {
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
    nearest = k < 0.5 ? a.d : b.d;
    if (document.documentElement.dataset.daytime !== nearest) document.documentElement.dataset.daytime = nearest;
  }

  // ── CSS fallback vars (only written while the fallback is visible) ──
  let lastCss = 0;
  function writeCss(now: number, force = false): void {
    if (!force && now - lastCss < 120) return;
    lastCss = now;
    cur.forEach((c, i) => {
      root.style.setProperty(`--f${i}`, `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`);
    });
  }

  let scrollDirty = true;
  let lastScroll = 0;
  addEventListener(
    'scroll',
    () => {
      scrollDirty = true;
      lastScroll = performance.now();
    },
    { passive: true },
  );
  addEventListener('resize', () => (scrollDirty = true), { passive: true });
  addEventListener('field:lock', (e) => {
    const d = (e as CustomEvent<Daytime | null>).detail;
    locked = d && d in PALS ? d : null;
    scrollDirty = true;
    kick();
  });

  // ── WebGL ──
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas?.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false }) ?? null;
  } catch {
    gl = null;
  }

  const fieldProg = gl ? build(gl, FIELD) : null;
  const presentProg = gl ? build(gl, PRESENT) : null;
  const useGL = Boolean(gl && fieldProg && presentProg && canvas);
  if (!useGL) gl = null;
  root.classList.toggle('field--gl', useGL);
  writeCss(0, true);

  type U = Record<string, WebGLUniformLocation | null>;
  const locs = (prog: WebGLProgram, names: string[]): U =>
    Object.fromEntries(names.map((n) => [n, gl!.getUniformLocation(prog, n)]));
  let uf: U = {};
  let up: U = {};
  let tex: WebGLTexture | null = null;
  let fbo: WebGLFramebuffer | null = null;

  if (gl && fieldProg && presentProg) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    uf = locs(fieldProg, ['uRes', 'uTime', 'uC', 'uPtr', 'uScale', 'uWarp', 'uDetail', 'uHalo', 'uRipple', 'uGrad']);
    up = locs(presentProg, ['uTex', 'uRes', 'uGrain', 'uFrame', 'uGrainSize', 'uTexel', 'uSoft']);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fbo = gl.createFramebuffer();
  }

  // live settings (dev toolbar)
  const applyOnOff = () => root.classList.toggle('field--off', !bg().fieldOn);
  applyOnOff();
  onBg((patch) => {
    if ('fieldOn' in patch) applyOnOff();
    if ('renderScale' in patch || 'maxDpr' in patch) w = 0; // force resize
    if ('adaptive' in patch && !bg().adaptive && dyn !== 1) {
      dyn = 1;
      w = 0;
    }
    if ('canvasBlur' in patch && canvas) canvas.style.filter = bg().canvasBlur ? `blur(${bg().canvasBlur}px)` : '';
    if (bg().fieldOn) writeCss(0, true);
    kick();
  });
  if (canvas && bg().canvasBlur) canvas.style.filter = `blur(${bg().canvasBlur}px)`;

  canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.classList.remove('field--gl', 'field--ready');
    gl = null;
  });

  // ── size: canvas at display resolution (≤ maxDpr), field texture at renderScale of it ──
  let w = 0, h = 0, fw = 0, fh = 0;
  /** adaptive multiplier on renderScale (1 = as configured) */
  let dyn = 1;
  let fboDirty = false;
  function resize(): void {
    if (!gl || !canvas) return;
    const c = bg();
    const dpr = Math.min(devicePixelRatio || 1, c.maxDpr);
    const nw = Math.max(1, Math.round(innerWidth * dpr));
    const nh = Math.max(1, Math.round(canvas.clientHeight * dpr));
    // ignore mobile toolbar jitter (canvas is 100lvh tall anyway)
    // Mobile URL bar show/hide changes the height on every scroll direction change. The field is
    // blurry, so let CSS stretch the canvas for that; only reallocate on real size changes.
    const smallHeightChange = Math.abs(nh - h) < Math.max(40 * dpr, h * 0.25);
    if (nw === w && smallHeightChange && !fboDirty) return;
    fboDirty = false;
    if (nw !== w || !smallHeightChange || !w) {
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
    }
    fw = Math.max(1, Math.round(w * c.renderScale * dyn));
    fh = Math.max(1, Math.round(h * c.renderScale * dyn));
    window.__bgStats = { dyn, frameMs: frameMs, fieldPx: `${fw}×${fh} → ${w}×${h}` };
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  addEventListener('resize', () => {
    resize();
    kick();
  });

  // ── pointer (fine pointers only) ──
  const ptr = { x: 0.5, y: 0.5, s: 0, ts: 0 };
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
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
  let clock = 12; // seconds of shader time (start mid-flow, not at a symmetric t=0)
  let ready = false;
  let frameMs = 0;
  let slow = 0;
  let calm = 0;

  function frame(now: number): void {
    raf = 0;
    const c = bg();
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    // while the page scrolls, give the GPU to content: hold the field (it moves too slowly to notice)
    if (c.pauseOnScroll && ready && now - lastScroll < 200) {
      last = 0; // don't count the pause as a slow frame
      raf = requestAnimationFrame(frame);
      return;
    }
    if (!motion.reduced && last && now - last < 1000 / c.fpsCap - 2) {
      // fps cap (30 by default): the field is slow; spend the battery elsewhere
      raf = requestAnimationFrame(frame);
      return;
    }
    // adaptive resolution: watch the interval between drawn frames
    if (last && !motion.reduced && !c.fieldPaused) {
      const iv = now - last;
      frameMs = frameMs ? frameMs * 0.9 + iv * 0.1 : iv;
      const budget = 1000 / c.fpsCap;
      if (c.adaptive && gl) {
        if (frameMs > budget * 1.35) {
          slow += dt;
          calm = 0;
        } else if (frameMs < budget * 1.12) {
          calm += dt;
          slow = 0;
        }
        if (slow > 1 && dyn > 0.5) {
          dyn = Math.max(0.5, +(dyn - 0.15).toFixed(2));
          slow = 0;
          fboDirty = true;
        } else if (calm > 6 && dyn < 1) {
          dyn = Math.min(1, +(dyn + 0.1).toFixed(2));
          calm = 0;
          fboDirty = true;
        }
      }
      if (window.__bgStats) window.__bgStats.frameMs = frameMs;
    }
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
      }

    if (!gl || !c.fieldOn) {
      // CSS fallback: keep easing while the palette moves, then write the final value once
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
    if (!fieldProg || !presentProg) return;

    // pass 1: field → low-res texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fw, fh);
    gl.useProgram(fieldProg);
    gl.uniform2f(uf.uRes!, fw, fh);
    gl.uniform1f(uf.uTime!, clock);
    gl.uniform3fv(uf.uC!, cur.flat());
    gl.uniform3f(uf.uPtr!, ptr.x, ptr.y, motion.reduced ? 0 : ptr.s);
    gl.uniform1f(uf.uScale!, c.scale);
    gl.uniform1f(uf.uWarp!, c.warp);
    gl.uniform1f(uf.uDetail!, Math.round(c.detail));
    gl.uniform1f(uf.uHalo!, c.halo);
    gl.uniform1f(uf.uRipple!, c.ripple);
    gl.uniform1f(uf.uGrad!, c.gradientNoise ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: upscale + grain at full canvas resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(presentProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(up.uTex!, 0);
    gl.uniform2f(up.uRes!, w, h);
    gl.uniform1f(up.uGrain!, c.grainOn ? c.grain : 0);
    // frame counter for the grain: wraps after ~6 min at 12 fps — never visible
    gl.uniform1f(up.uFrame!, still || !c.grainAnimated ? 1 : Math.floor((now / 1000) * c.grainFps) % 4096);
    gl.uniform1f(up.uGrainSize!, Math.max(1, c.grainSize));
    gl.uniform2f(up.uTexel!, 1 / fw, 1 / fh);
    gl.uniform1f(up.uSoft!, c.soften);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!ready) {
      ready = true;
      root.classList.add('field--ready');
    }

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

function build(gl: WebGLRenderingContext, frag: string): WebGLProgram | null {
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
  const f = sh(gl.FRAGMENT_SHADER, frag);
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
