/**
 * `<mappy-catalog>` — custom element that owns all catalog UI behaviour:
 * instrument search, expand/collapse, chapter-deck navigation, guild-favourite
 * jump buttons, sticky toolbar backdrop, and stats readout.
 *
 * DOM CONTRACT (produced by scripts/lib/render-site-page.mjs — keep in sync):
 *   #instrument-search                         search input
 *   #catalog-stats, #catalog-search-empty      live stats + empty-state nodes
 *   #sections-expand-all / -collapse-all       toolbar buttons
 *   .section-drawer (details), id = chapter slug   collapsible chapter
 *   .instrument-atlas__item, .instrument--spotlight  searchable rows;
 *       data-search (haystack), data-search-label (title), data-instrument-slug
 *   .chapter-card                       deck card; href="#<chapter-slug>"
 *   .catalog-highlight + [data-highlight-jump="<instrument-slug>"]   guild favourite
 *   .catalog__toolbar-sticky            sticky search bar wrapper
 *
 * CLAD tier: App (wires atoms + molecules into a live DOM controller)
 */

import { isModifiedClick, openAncestorDetails, getScrollAnchor, scrollPaddingTop } from '../atoms/dom-utils.mjs';
import { fillStatsTemplate } from '../atoms/stats.mjs';
import { setupDetailsAnimation } from '../atoms/details-animate.mjs';
import { applySearchFilter } from '../molecules/search-filter.mjs';
import { scrollToRevealed, navigateToHash, scrollToLocationHash } from '../molecules/scroll-nav.mjs';
import { setupStickyBackdrop } from '../molecules/sticky-backdrop.mjs';

class MappyCatalog extends HTMLElement {
  /** @type {((e: Event) => void) | null} */ #onInput = null;
  /** @type {((e: Event) => void) | null} */ #onKeydown = null;
  /** @type {((e: Event) => void) | null} */ #onClick = null;
  /** @type {(() => void) | null} */ #onHashChange = null;
  /** @type {(() => void) | null} */ #onLocaleApplied = null;
  /** @type {IntersectionObserver | null} */ #stickyObserver = null;
  /** @type {{ disconnect: () => void } | null} */ #sectionAnim = null;
  /** @type {{ disconnect: () => void } | null} */ #atlasAnim = null;

  // ── Element queries (scoped to this custom element) ──────────────────────

  #searchInput() { return this.querySelector('#instrument-search'); }
  #statsEl()     { return this.querySelector('#catalog-stats'); }
  #emptyEl()     { return this.querySelector('#catalog-search-empty'); }
  #drawers()     { return /** @type {HTMLDetailsElement[]} */ (Array.from(this.querySelectorAll('.section-drawer'))); }
  #items()       { return /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('.instrument-atlas__item, .instrument--spotlight'))); }
  #chapterCards(){ return /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('.chapter-card'))); }
  #highlights()  { return /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('.catalog-highlight'))); }

  /** @param {string | null | undefined} id @returns {HTMLDetailsElement | null} */
  #drawerForId(id) {
    if (!id) return null;
    const el = document.getElementById(id);
    return el instanceof HTMLDetailsElement ? el : null;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  #statsTemplates() {
    const body = document.body;
    const totalInstruments = Number(body.dataset.siteTotalInstruments) || this.#items().length;
    const totalChapters    = Number(body.dataset.siteTotalChapters) || this.#chapterCards().length;
    return {
      totalInstruments,
      totalChapters,
      defaultTpl:  body.dataset.siteStatsDefault  ?? '{total} instruments · {open} chapter(s) open',
      filteredTpl: body.dataset.siteStatsFiltered ?? '{visible} of {total} instruments · {chaptersVisible} of {chaptersTotal} chapters',
    };
  }

  #updateStats() {
    const statsEl = this.#statsEl();
    if (!statsEl) return;
    const emptyEl  = this.#emptyEl();
    const q        = (this.#searchInput()?.value ?? '').trim();
    const items    = this.#items();
    const drawers  = this.#drawers();
    const cards    = this.#chapterCards();
    const visibleInstruments = items.filter((el) => !el.hidden).length;
    const visibleChapters    = cards.filter((c) => !c.hidden).length;
    const open               = drawers.filter((d) => d.open && !d.hidden).length;
    const { totalInstruments, totalChapters, defaultTpl, filteredTpl } = this.#statsTemplates();

    if (emptyEl) emptyEl.hidden = !q || visibleInstruments > 0;

    statsEl.textContent = q
      ? fillStatsTemplate(filteredTpl, { visible: visibleInstruments, total: totalInstruments, chaptersVisible: visibleChapters, chaptersTotal: totalChapters })
      : fillStatsTemplate(defaultTpl,  { total: totalInstruments, open });

    this.#syncToggleAllLabel();
  }

  // ── Animated fold-all ─────────────────────────────────────────────────────

  /** @param {HTMLDetailsElement[]} drawers */
  #animateFoldAll(drawers) {
    let settled = 0;
    const total = drawers.length;
    const onDone = () => {
      settled++;
      if (settled >= total) {
        this.#updateStats();
        this.#syncToggleAllLabel();
      }
    };
    for (const d of drawers) {
      if (!d.open) { onDone(); continue; }
      const body = /** @type {HTMLElement | null} */ (d.querySelector('.section-drawer__body'));
      if (!body) { d.open = false; onDone(); continue; }
      d.classList.add('is-closing');
      const finish = () => {
        d.classList.remove('is-closing');
        d.open = false;
        onDone();
      };
      body.addEventListener('transitionend', finish, { once: true });
      const dur = parseFloat(getComputedStyle(body).transitionDuration) || 0;
      setTimeout(finish, dur * 1000 + 60);
    }
  }

  // ── Unfold/Fold toggle label ───────────────────────────────────────────────

  #syncToggleAllLabel() {
    const btn = this.querySelector('#sections-toggle-all');
    if (!(btn instanceof HTMLButtonElement)) return;
    const drawers = this.#drawers().filter((d) => !d.hidden);
    const allOpen = drawers.length > 0 && drawers.every((d) => d.open);
    btn.textContent = allOpen
      ? (btn.dataset.fold ?? 'Fold all')
      : (btn.dataset.unfold ?? 'Unfold all');
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  #applySearch() {
    const q = (this.#searchInput()?.value ?? '').trim();
    applySearchFilter({
      q,
      items:         this.#items(),
      drawers:       this.#drawers(),
      chapterCards:  this.#chapterCards(),
      highlightCards: this.#highlights(),
      drawerForId:   (id) => this.#drawerForId(id),
    });
    this.#updateStats();
  }

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  /** Full reveal: clears search if active, opens drawers, then scrolls. */
  #scrollTo(target) {
    scrollToRevealed(
      target,
      () => this.#searchInput(),
      () => this.#applySearch(),
    );
  }

  /**
   * Opens drawers and scrolls to `target` WITHOUT touching the search input.
   * Used by highlight-jump so the slug filter stays active while the item is
   * revealed and scrolled into view.
   */
  #scrollToWithoutClearingSearch(target) {
    const sectionDrawer = target.closest('.section-drawer');
    if (sectionDrawer instanceof HTMLDetailsElement) {
      sectionDrawer.hidden = false;
      sectionDrawer.open = true;
    }
    openAncestorDetails(target);

    // Scroll to the SECTION HEADER (summary), not into the expanded body,
    // so the user lands at the drawer title with the instrument visible below.
    // If the target has no containing section drawer, fall back to the item.
    const scrollAnchor =
      (sectionDrawer instanceof HTMLDetailsElement
        ? sectionDrawer.querySelector('.section-drawer__summary')
        : null) ??
      getScrollAnchor(target);

    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    // Wait for the section-drawer grid-template-rows transition (0.32 s) to
    // settle before computing the final rect, then scroll.
    const DRAWER_TRANSITION_MS = 340;

    const run = () => {
      const pad  = scrollPaddingTop();
      if (!document.body.contains(scrollAnchor)) return;
      const rect = scrollAnchor.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - pad), behavior });
      this.#flashTarget(target);
    };

    setTimeout(run, DRAWER_TRANSITION_MS);
  }

  /** Briefly adds `.is-target` to `el` so CSS can pulse it, then removes it. */
  #flashTarget(el) {
    el.classList.remove('is-target');
    // Force a reflow so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add('is-target');
    el.addEventListener('animationend', () => el.classList.remove('is-target'), { once: true });
  }

  #scrollToHash() {
    scrollToLocationHash((target) => this.#scrollTo(target));
  }

  // ── Sticky backdrop ────────────────────────────────────────────────────────

  #refreshStickyBackdrop() {
    this.#stickyObserver?.disconnect();
    const stickyEl = this.querySelector('.catalog__toolbar-sticky');
    this.#stickyObserver = setupStickyBackdrop(stickyEl);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    this.#onInput = (e) => {
      if (e.target instanceof HTMLInputElement && e.target.id === 'instrument-search') {
        this.#applySearch();
      }
    };

    this.#onKeydown = (e) => {
      if (!(e.target instanceof HTMLInputElement) || e.target.id !== 'instrument-search') return;
      if (/** @type {KeyboardEvent} */ (e).key === 'Escape') {
        e.target.value = '';
        this.#applySearch();
        e.target.blur();
      }
    };

    this.#onClick = (e) => {
      if (isModifiedClick(/** @type {MouseEvent} */ (e))) return;

      const link = /** @type {HTMLElement | null} */ (e.target)?.closest?.('a[href^="#"]');
      if (link instanceof HTMLAnchorElement) {
        const href = link.getAttribute('href');
        if (href && href !== '#') {
          let id;
          try { id = decodeURIComponent(href.slice(1)); } catch { id = href.slice(1); }
          if (id && document.getElementById(id)) {
            e.preventDefault();
            navigateToHash(id, { replace: link.classList.contains('chapter-card') }, (t) => this.#scrollTo(t));
            return;
          }
        }
      }

      const jump = /** @type {HTMLElement | null} */ (e.target)?.closest?.('[data-highlight-jump]');
      if (jump instanceof HTMLElement) {
        const slug = jump.getAttribute('data-highlight-jump');
        if (!slug) return;
        e.preventDefault();
        const target = document.querySelector(`[data-instrument-slug="${slug}"]`);
        if (target instanceof HTMLElement) this.#scrollToWithoutClearingSearch(target);
      }
    };

    this.#onHashChange = () => this.#scrollToHash();

    this.#onLocaleApplied = () => {
      const input = this.#searchInput();
      if (input) input.value = '';
      this.#applySearch();
      this.#updateStats();
      this.#refreshStickyBackdrop();
      if (location.hash) setTimeout(() => this.#scrollToHash(), 50);
    };

    document.addEventListener('input', this.#onInput);
    document.addEventListener('keydown', this.#onKeydown);
    document.addEventListener('click', this.#onClick);
    window.addEventListener('hashchange', this.#onHashChange);
    window.addEventListener('site-locale-applied', this.#onLocaleApplied);

    const toggleAllBtn = this.querySelector('#sections-toggle-all');
    if (toggleAllBtn instanceof HTMLButtonElement) {
      toggleAllBtn.addEventListener('click', () => {
        const drawers = this.#drawers().filter((d) => !d.hidden);
        const allOpen = drawers.every((d) => d.open);
        if (allOpen) {
          this.#animateFoldAll(drawers);
        } else {
          for (const d of drawers) d.open = true;
          this.#updateStats();
          this.#syncToggleAllLabel();
        }
      });
    }

    for (const drawer of this.#drawers()) {
      drawer.addEventListener('toggle', () => this.#updateStats());
    }

    this.#refreshStickyBackdrop();

    // Smooth close animations for both drawer tiers.
    this.#sectionAnim = setupDetailsAnimation(this, '.section-drawer',        '.section-drawer__body');
    this.#atlasAnim   = setupDetailsAnimation(this, '.instrument-atlas__drawer', '.instrument-atlas__body');

    this.#updateStats();

    if (location.hash) setTimeout(() => this.#scrollToHash(), 0);
  }

  disconnectedCallback() {
    if (this.#onInput)        document.removeEventListener('input',    this.#onInput);
    if (this.#onKeydown)      document.removeEventListener('keydown',  this.#onKeydown);
    if (this.#onClick)        document.removeEventListener('click',    this.#onClick);
    if (this.#onHashChange)   window.removeEventListener('hashchange', this.#onHashChange);
    if (this.#onLocaleApplied)window.removeEventListener('site-locale-applied', this.#onLocaleApplied);
    this.#stickyObserver?.disconnect();
    this.#stickyObserver = null;
    this.#sectionAnim?.disconnect();
    this.#sectionAnim = null;
    this.#atlasAnim?.disconnect();
    this.#atlasAnim = null;
  }
}

customElements.define('mappy-catalog', MappyCatalog);
