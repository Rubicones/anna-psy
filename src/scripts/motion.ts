/** Shared reduced-motion state with live updates. */
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export const motion = {
  get reduced(): boolean {
    return mq?.matches ?? false;
  },
  onChange(cb: (reduced: boolean) => void): void {
    mq?.addEventListener('change', (e) => cb(e.matches));
  },
};
