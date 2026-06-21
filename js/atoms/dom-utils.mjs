/**
 * Pure DOM helpers — no application logic, no side effects on import.
 * CLAD tier: Atom
 */

/** Open every nested `<details>` ancestor so a scroll target is never collapsed. */
/** @param {Element} el */
export function openAncestorDetails(el) {
  let node = el.parentElement;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
}

/**
 * Returns the total pixel height of all currently-pinned sticky layers
 * (site header + sticky toolbar when active) plus a small breathing gap.
 */
export function scrollPaddingTop() {
  let total = 0;

  const header = document.querySelector('.site-header');
  if (header) {
    total += header.getBoundingClientRect().height;
  } else {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const raw  = getComputedStyle(document.documentElement)
      .getPropertyValue('--site-header-sticky-offset')
      .trim();
    total += raw.endsWith('rem') ? parseFloat(raw) * root : (parseFloat(raw) || 57);
  }

  // Always include the catalog toolbar height — it is position:sticky so it
  // covers content whenever the catalog is in view, whether or not is-stuck
  // has been toggled yet by the scroll listener.
  const stickyToolbar = document.querySelector('.catalog__toolbar-sticky');
  if (stickyToolbar instanceof HTMLElement) {
    total += stickyToolbar.getBoundingClientRect().height;
  }

  return total + 12; // breathing gap
}

/**
 * Returns true when the click should not be intercepted (modifier key, non-primary button,
 * or already default-prevented).
 * @param {MouseEvent} e
 */
export function isModifiedClick(e) {
  return (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  );
}

/**
 * Prefer a visible summary anchor over scrolling a collapsed `<details>` box.
 * @param {HTMLElement} target
 */
export function getScrollAnchor(target) {
  const atlasDrawer =
    target.querySelector?.('.instrument-atlas__drawer') ??
    target.closest?.('.instrument-atlas__drawer');
  if (atlasDrawer instanceof HTMLDetailsElement) {
    const summary = atlasDrawer.querySelector('.instrument-atlas__summary');
    if (summary instanceof HTMLElement) return summary;
  }
  if (target instanceof HTMLDetailsElement && target.classList.contains('section-drawer')) {
    const summary = target.querySelector('.section-drawer__summary');
    if (summary instanceof HTMLElement) return summary;
  }
  return target;
}
