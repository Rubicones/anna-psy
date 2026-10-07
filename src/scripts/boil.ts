/**
 * Line boil: step the turbulence seed of every [data-boil] filter at ~10 fps,
 * like redrawn frames of hand animation. Runs only while a boiled element is on screen,
 * never with reduced motion (the static displacement keeps the hand-drawn look).
 */
import { bg, onBg } from './bg';
import { motion } from './motion';

const SEEDS = [3, 8, 13];

export function initBoil(): void {
  const turbs = Array.from(document.querySelectorAll<SVGFETurbulenceElement>('feTurbulence[data-boil]'));
  if (!turbs.length) return;

  const visible = new Set<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      schedule();
    },
    { rootMargin: '10% 0px' },
  );
  // anything that uses a boiling filter, plus elements that boil on hover/focus
  document.querySelectorAll('[filter="url(#boil)"], .boils').forEach((el) => io.observe(el));

  let frame = 0;
  let timer = 0;
  const tick = () => {
    // hold the boil while the page scrolls: every step re-runs the filter on all visible drawings
    if (bg().pauseOnScroll && document.documentElement.classList.contains('is-scrolling')) return;
    frame = (frame + 1) % SEEDS.length;
    const base = SEEDS[frame] ?? 3;
    turbs.forEach((t, i) => t.setAttribute('seed', String(base + i * 2)));
  };

  let fps = bg().boilFps;
  function schedule(): void {
    const c = bg();
    if (timer && fps !== c.boilFps) {
      clearInterval(timer);
      timer = 0;
    }
    fps = c.boilFps;
    const run = c.boilOn && !motion.reduced && !document.hidden && (visible.size > 0 || document.activeElement?.matches('.hand-focus'));
    if (run && !timer) timer = window.setInterval(tick, 1000 / Math.max(1, fps));
    if (!run && timer) {
      clearInterval(timer);
      timer = 0;
    }
  }

  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('focusin', schedule);
  motion.onChange(schedule);
  onBg(schedule);
  schedule();
}
