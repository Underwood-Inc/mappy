/**
 * Hash-based scroll navigation and drawer reveal for the landing catalog.
 * CLAD tier: Molecule
 */
import { openAncestorDetails, scrollPaddingTop, getScrollAnchor } from '../atoms/dom-utils.mjs';

/**
 * Clears the search input, re-runs the filter, and opens the target's ancestor
 * drawers so the element is reachable for scrolling.
 * @param {HTMLElement} target
 * @param {() => HTMLInputElement | null} getSearchInput
 * @param {() => void} applySearch
 */
export function revealForScroll(target, getSearchInput, applySearch) {
  const input = getSearchInput();
  if (input?.value.trim()) {
    input.value = '';
    applySearch();
  }
  const sectionDrawer = target.closest('.section-drawer');
  if (sectionDrawer instanceof HTMLDetailsElement) {
    sectionDrawer.hidden = false;
    sectionDrawer.open = true;
  }
  openAncestorDetails(target);
}

/**
 * Reveals `target` (clears search, opens drawers) then smooth-scrolls to it.
 * @param {HTMLElement} target
 * @param {() => HTMLInputElement | null} getSearchInput
 * @param {() => void} applySearch
 */
export function scrollToRevealed(target, getSearchInput, applySearch) {
  revealForScroll(target, getSearchInput, applySearch);
  const anchor = getScrollAnchor(target);
  const pad = scrollPaddingTop();
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const needsLayoutWait = Boolean(anchor.closest('details'));

  const run = () => {
    if (!document.body.contains(anchor)) return;
    const rect = anchor.getBoundingClientRect();
    if (rect.height === 0 && anchor.closest('[hidden]')) return;
    const top = Math.max(0, rect.top + window.scrollY - pad);
    window.scrollTo({ top, behavior });
  };

  if (needsLayoutWait) {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(run, 100)));
  } else {
    requestAnimationFrame(() => requestAnimationFrame(run));
  }
}

/**
 * Scroll to element by `id`, updating the browser history entry.
 * @param {string} id
 * @param {{ replace?: boolean }} opts
 * @param {(target: HTMLElement) => void} scrollFn
 */
export function navigateToHash(id, opts = {}, scrollFn) {
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)) return false;
  scrollFn(target);
  const nextHash = `#${id}`;
  if (location.hash === nextHash) return true;
  if (opts.replace) history.replaceState(null, '', nextHash);
  else history.pushState(null, '', nextHash);
  return true;
}

/**
 * Reads `location.hash` and scrolls to the matching element if found.
 * @param {(target: HTMLElement) => void} scrollFn
 */
export function scrollToLocationHash(scrollFn) {
  const raw = location.hash.slice(1);
  if (!raw) return;
  let id;
  try {
    id = decodeURIComponent(raw);
  } catch {
    id = raw;
  }
  const el = document.getElementById(id);
  if (el instanceof HTMLElement) scrollFn(el);
}
