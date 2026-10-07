/**
 * Idle micro-life runs only for drawings that are on screen: .is-onscreen toggles
 * animation-play-state (and a compositor layer) in Illustration.astro.
 */
export function initLife(): void {
  const els = document.querySelectorAll('.illo.has-life');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.target.classList.toggle('is-onscreen', e.isIntersecting);
    },
    { rootMargin: '10% 0px' },
  );
  els.forEach((el) => io.observe(el));
}
