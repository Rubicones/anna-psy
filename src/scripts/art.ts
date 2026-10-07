/** Entry point for the art layer. Loaded once per page from BaseLayout. */
import { initBoil } from './boil';
import { initDrawOn } from './draw-on';
import { initField } from './field';
import { initGrain } from './grain';
import { initLife } from './life';
import { initPerfClasses } from './perf-classes';

initPerfClasses();
const field = document.querySelector<HTMLElement>('[data-field]');
if (field) {
  initField(field);
  initGrain(field);
}
initBoil();
initDrawOn();
initLife();
