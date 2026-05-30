/**
 * Search-filter logic for the landing catalog.
 * Pure functions — callers pass in live element collections.
 * CLAD tier: Molecule
 */
import { matchesSearchQuery, queryLooksAdvanced } from '../mappy-search-query-parser.mjs';
import { applyHighlight, clearHighlight, termsFromQuery } from '../atoms/text-highlight.mjs';

/** @param {HTMLDetailsElement} drawer */
export function drawerHasVisibleInstruments(drawer) {
  return Boolean(
    drawer.querySelector(
      '.instrument-atlas__item:not([hidden]), .instrument--spotlight:not([hidden])',
    ),
  );
}

/** @param {HTMLElement} el @param {string} query */
export function haystackMatches(el, query) {
  const hay = el.getAttribute('data-search') ?? '';
  if (!matchesSearchQuery) return hay.toLowerCase().includes(query.toLowerCase());
  return matchesSearchQuery(hay, query);
}

/** @param {HTMLElement} el @param {string} query */
export function instrumentMatches(el, query) {
  return haystackMatches(el, query);
}

/** @param {HTMLElement} el @param {string} query */
export function instrumentScore(el, query) {
  const hay = el.getAttribute('data-search') ?? '';
  const label = (el.getAttribute('data-search-label') ?? '').toLowerCase();
  const q = query.trim();
  if (!q) return 0;

  let score = el.classList.contains('instrument--spotlight') ? 8 : 4;
  if (matchesSearchQuery(hay, q)) score += 5;
  if (label && matchesSearchQuery(label, q)) score += 10;

  if (!queryLooksAdvanced(q)) {
    const qLower = q.toLowerCase();
    if (label === qLower) score += 100;
    else if (label.startsWith(qLower)) score += 40;
    else if (label.includes(qLower)) score += 12;
  }

  return score;
}

/** @param {HTMLDetailsElement} drawer @param {string} q */
export function syncDrawerVisibility(drawer, q) {
  if (!q) {
    drawer.hidden = false;
    return;
  }
  drawer.hidden = !drawerHasVisibleInstruments(drawer);
  if (!drawer.hidden) drawer.open = true;
}

/**
 * @param {string} q
 * @param {HTMLElement[]} chapterCards
 * @param {(id: string | null | undefined) => HTMLDetailsElement | null} drawerForId
 */
export function syncChapterDeck(q, chapterCards, drawerForId) {
  for (const card of chapterCards) {
    if (!q) {
      card.hidden = false;
      card.style.removeProperty('--chapter-order');
      continue;
    }
    const drawer = drawerForId(card.getAttribute('href')?.slice(1));
    const hasInstruments = drawer ? drawerHasVisibleInstruments(drawer) : false;
    card.hidden = !hasInstruments;
    if (!card.hidden && drawer) {
      const visibleCount = drawer.querySelectorAll(
        '.instrument-atlas__item:not([hidden]), .instrument--spotlight:not([hidden])',
      ).length;
      card.style.setProperty('--chapter-order', String(-visibleCount));
    }
  }
}

/** @param {string} q @param {HTMLElement[]} highlightCards */
export function syncGuildFavorites(q, highlightCards) {
  for (const card of highlightCards) {
    const btn = card.querySelector('[data-highlight-jump]');
    if (!(btn instanceof HTMLButtonElement)) continue;
    if (!q) {
      btn.disabled = false;
      btn.classList.remove('catalog-highlight__jump--dimmed');
      continue;
    }
    const slug = btn.getAttribute('data-highlight-jump');
    const target = slug ? document.querySelector(`[data-instrument-slug="${slug}"]`) : null;
    const matches = Boolean(target && !target.hidden);
    btn.disabled = !matches;
    btn.classList.toggle('catalog-highlight__jump--dimmed', !matches);
  }
}

/**
 * Runs a full search pass over the catalog DOM.
 * @param {{
 *   q: string;
 *   items: HTMLElement[];
 *   drawers: HTMLDetailsElement[];
 *   chapterCards: HTMLElement[];
 *   highlightCards: HTMLElement[];
 *   drawerForId: (id: string | null | undefined) => HTMLDetailsElement | null;
 * }} config
 */
/** Elements whose text we highlight inside each instrument row. */
const TITLE_SELECTORS = [
  '.instrument-atlas__title',
  '.instrument-atlas__peek',
  '.instrument__name',
  // Body content — visible when inner <details> auto-opens on search match
  '.instrument-atlas__what',
  '.instrument-atlas__meta dd',
];

/**
 * Apply or clear inline text highlights on an instrument row element.
 * @param {HTMLElement} el
 * @param {string[]} terms
 */
function highlightRow(el, terms) {
  for (const sel of TITLE_SELECTORS) {
    for (const target of el.querySelectorAll(sel)) {
      if (terms.length) applyHighlight(target, terms);
      else clearHighlight(target);
    }
  }
}

export function applySearchFilter({ q, items, drawers, chapterCards, highlightCards, drawerForId }) {
  const terms = q ? termsFromQuery(q) : [];

  if (!q) {
    for (const el of items) {
      el.hidden = false;
      el.classList.remove('is-match');
      el.style.removeProperty('--instrument-order');
      highlightRow(el, []);
      for (const d of el.querySelectorAll('details')) {
        /** @type {HTMLDetailsElement} */ (d).open = false;
        d.removeAttribute('data-search-open');
      }
    }
    for (const drawer of drawers) drawer.hidden = false;
    syncChapterDeck('', chapterCards, drawerForId);
    syncGuildFavorites('', highlightCards);
    return;
  }

  /** @type {{ el: HTMLElement; score: number }[]} */
  const ranked = [];
  for (const el of items) {
    const match = instrumentMatches(el, q);
    el.hidden = !match;
    el.classList.toggle('is-match', match);
    highlightRow(el, match ? terms : []);
    if (match) {
      ranked.push({ el, score: instrumentScore(el, q) });
      // Auto-open and lock inner <details> via data-search-open.
      for (const d of el.querySelectorAll('details')) {
        /** @type {HTMLDetailsElement} */ (d).open = true;
        d.setAttribute('data-search-open', '');
      }
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach(({ el }, index) => el.style.setProperty('--instrument-order', String(index)));

  for (const drawer of drawers) syncDrawerVisibility(drawer, q);
  syncChapterDeck(q, chapterCards, drawerForId);
  syncGuildFavorites(q, highlightCards);
}
