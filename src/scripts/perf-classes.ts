/**
 * CSS-driven performance switches. The inline head script sets the initial classes from the
 * device tier (so the first paint is already light); this keeps them in sync with bg settings
 * when the dev toolbar changes them. Also flags html.is-scrolling while the page scrolls
 * (idle drawing animations and line boil hold still, so the GPU goes to content).
 */
import { bg, onBg } from './bg';

export function initPerfClasses(): void {
  const html = document.documentElement.classList;
  const sync = () => {
    const c = bg();
    html.toggle('bg-no-frost', !c.frostBlur);
    html.toggle('bg-no-draw-filter', !c.drawFilter);
    html.toggle('bg-no-life', !c.lifeOn);
  };
  sync();
  onBg(sync);

  let t = 0;
  addEventListener(
    'scroll',
    () => {
      if (!bg().pauseOnScroll) return;
      if (!t) html.add('is-scrolling');
      clearTimeout(t);
      t = window.setTimeout(() => {
        html.remove('is-scrolling');
        t = 0;
      }, 180);
    },
    { passive: true },
  );
}
