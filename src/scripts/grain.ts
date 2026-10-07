/**
 * Film grain over the field — practically free.
 *
 * One static canvas of true random noise (Math.random, no hash structure, no tiling) is painted
 * once per width change. "Animation" moves that canvas by random whole-cell offsets a few times a
 * second via CSS transform: the compositor just shifts an existing GPU layer, nothing is repainted.
 * Pure random noise shifted by random amounts never forms crawling lines.
 */
import { bg, onBg } from './bg';
import { motion } from './motion';

const M = 48; // jitter margin, CSS px

export function initGrain(root: HTMLElement): void {
  const cv = root.querySelector<HTMLCanvasElement>('.field__grain');
  if (!cv) return;
  const ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  let paintedW = 0;
  let paintedSize = 0;
  function paint(): void {
    const size = Math.max(1, Math.round(bg().grainSize));
    // tall enough for any URL-bar state, so height changes never force a repaint
    const cssW = innerWidth + M * 2;
    const cssH = Math.max(innerHeight, screen.height || 0) + 120 + M * 2;
    if (paintedW === cssW && paintedSize === size) return;
    paintedW = cssW;
    paintedSize = size;
    const W = Math.ceil(cssW / size);
    const H = Math.ceil(cssH / size);
    cv!.width = W;
    cv!.height = H;
    cv!.style.width = `${W * size}px`;
    cv!.style.height = `${H * size}px`;
    const img = ctx!.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = Math.random();
      const light = r > 0.5;
      // warm ink speckles and warm-white speckles; strength grows towards the tails
      d[i] = light ? 255 : 44;
      d[i + 1] = light ? 250 : 38;
      d[i + 2] = light ? 240 : 32;
      d[i + 3] = (Math.abs(r - 0.5) * 2) ** 1.6 * 255;
    }
    ctx!.putImageData(img, 0, 0);
  }

  const applyOpacity = () => {
    const c = bg();
    cv.style.opacity = String(c.grainOn ? c.grain : 0);
  };

  let timer = 0;
  function schedule(): void {
    const c = bg();
    clearInterval(timer);
    timer = 0;
    if (!c.grainOn || !c.grainAnimated || motion.reduced || document.hidden) return;
    const step = Math.max(1, Math.round(c.grainSize));
    timer = window.setInterval(() => {
      const x = Math.round(((Math.random() * 2 - 1) * M) / step) * step;
      const y = Math.round(((Math.random() * 2 - 1) * M) / step) * step;
      cv!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }, 1000 / Math.max(1, c.grainFps));
  }

  paint();
  applyOpacity();
  schedule();
  addEventListener('resize', () => paint());
  document.addEventListener('visibilitychange', schedule);
  motion.onChange(schedule);
  onBg((patch) => {
    if ('grainSize' in patch) paint();
    applyOpacity();
    schedule();
  });
}
