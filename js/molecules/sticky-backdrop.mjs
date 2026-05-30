/**
 * Sticky toolbar backdrop toggle.
 * Adds `.is-stuck` to the toolbar element while it is pinned below the header.
 * Uses a passive scroll listener + getBoundingClientRect — avoids IntersectionObserver
 * timing issues with CSS custom-property `top` values at component-upgrade time.
 * CLAD tier: Molecule
 *
 * @param {HTMLElement | null} stickyEl  The `.catalog__toolbar-sticky` element.
 * @returns {{ disconnect: () => void } | null}  Call `.disconnect()` on cleanup.
 */
export function setupStickyBackdrop(stickyEl) {
  if (!(stickyEl instanceof HTMLElement)) return null;

  // Remove any sentinel left from a previous call.
  stickyEl.parentNode?.querySelector('.catalog__sticky-sentinel')?.remove();

  let stickyTop = NaN;

  function resolveTop() {
    const raw = getComputedStyle(stickyEl).top;
    const px = parseFloat(raw);
    stickyTop = Number.isFinite(px) ? px : 57;
  }

  function check() {
    if (!Number.isFinite(stickyTop)) resolveTop();
    const rect = stickyEl.getBoundingClientRect();
    stickyEl.classList.toggle('is-stuck', Math.round(rect.top) <= Math.round(stickyTop) + 1);
  }

  // Resolve `top` lazily after first paint so CSS variables are computed.
  requestAnimationFrame(resolveTop);

  window.addEventListener('scroll', check, { passive: true });
  // Immediate check in case the page is already scrolled past the sticky point.
  check();

  return {
    disconnect() {
      window.removeEventListener('scroll', check);
      stickyEl.classList.remove('is-stuck');
    },
  };
}
