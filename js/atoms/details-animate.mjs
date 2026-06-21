/**
 * Smooth close animation for native `<details>` elements.
 *
 * The `grid-template-rows: 0fr → 1fr` trick animates **opening** naturally
 * because the browser adds `[open]` before layout, so CSS sees the transition.
 * **Closing** is instant by default: the browser removes `[open]` immediately,
 * collapsing the grid row before any transition can play.
 *
 * Fix: intercept `<summary>` clicks when the drawer is open, prevent the
 * default toggle, add `.is-closing` (which CSS uses to animate back to `0fr`),
 * then remove `[open]` after `transitionend`.
 *
 * CLAD tier: Atom (pure behaviour, no side effects outside the passed root)
 *
 * @param {HTMLElement} root        - scoping root (events stay inside)
 * @param {string}      detailsSel  - CSS selector matching the `<details>` elements
 * @param {string}      bodySel     - CSS selector for the animated body child
 * @returns {{ disconnect: () => void }}
 */
export function setupDetailsAnimation(root, detailsSel, bodySel) {
  /** @param {Event} e */
  const handler = (e) => {
    const summary = /** @type {HTMLElement} */ (e.target)?.closest?.('summary');
    if (!summary) return;

    const details = summary.closest(detailsSel);
    // Ensure the summary belongs directly to this details, not to a nested one.
    if (!(details instanceof HTMLDetailsElement) || summary.parentElement !== details) return;
    if (!details.open) return;

    // Search is locking this drawer open — block the close entirely.
    if (details.hasAttribute('data-search-open')) {
      e.preventDefault();
      return;
    }

    if (details.classList.contains('is-closing')) return; // already mid-animation

    // Prevent the browser's instant close; we drive it ourselves.
    e.preventDefault();

    const body = /** @type {HTMLElement | null} */ (details.querySelector(bodySel));
    if (!body) {
      details.open = false;
      return;
    }

    details.classList.add('is-closing');

    const finish = () => {
      details.classList.remove('is-closing');
      details.open = false;
    };

    body.addEventListener('transitionend', finish, { once: true });

    // Safety fallback: if transitionend never fires (e.g., reduced-motion or
    // no transition declared), close immediately after the declared duration.
    const durationS = parseFloat(getComputedStyle(body).transitionDuration) || 0;
    setTimeout(finish, durationS * 1000 + 60);
  };

  root.addEventListener('click', handler);
  return { disconnect: () => root.removeEventListener('click', handler) };
}
