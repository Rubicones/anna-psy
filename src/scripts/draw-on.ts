/**
 * Draw-on: [data-draw] drawings get .is-drawn when they enter the viewport.
 * Styling lives in Illustration.astro (stroke-dashoffset with per-path stagger).
 * `replayDraw(el)` restarts it (used on the styleguide).
 */
export function initDrawOn(): void {
  const els = document.querySelectorAll<SVGElement>('[data-draw]');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-drawn');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.35 },
  );
  els.forEach((el) => io.observe(el));
}

export function replayDraw(el: Element): void {
  el.classList.remove('is-drawn');
  // force style flush so the transition restarts from the hidden state
  void (el as SVGElement).getBoundingClientRect();
  requestAnimationFrame(() => el.classList.add('is-drawn'));
}
