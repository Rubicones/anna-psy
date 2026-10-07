/** Entry point for the art layer. Loaded once per page from BaseLayout. */
import { initBoil } from './boil';
import { initDrawOn } from './draw-on';
import { initField } from './field';

const field = document.querySelector<HTMLElement>('[data-field]');
if (field) initField(field);
initBoil();
initDrawOn();
