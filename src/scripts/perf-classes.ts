/**
 * CSS-driven performance switches. The inline head script sets the initial classes from the
 * device tier (so the first paint is already light); this keeps them in sync with bg settings
 * when the dev toolbar changes them.
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
}
