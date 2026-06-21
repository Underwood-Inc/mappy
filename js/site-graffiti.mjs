/**
 * Cursor ink trail (viewport overlay).
 * CLAD tier: Atom (canvas only, no external deps)
 */

const TRAIL_MAX = 72;
const TRAIL_LIFE_MS = 2160;
const TRAIL_MIN_DIST = 2;
const TRAIL_WIDTH = 1.15;
const TRAIL_MIN_DIST_SQ = TRAIL_MIN_DIST * TRAIL_MIN_DIST;
const MAX_TRAIL_DPR = 1;

const finePointer = window.matchMedia('(pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** @typedef {{ x: number; y: number; t: number; kind: 'ink' }} TrailPoint */
/** @typedef {'ink' | 'zoom' | 'none'} TrailMode */

/** @type {HTMLCanvasElement | null} */
let trailCanvas = null;
/** @type {CanvasRenderingContext2D | null} */
let trailCtx = null;
/** @type {TrailPoint[]} */
let trail = [];
/** @type {number} */
let trailHead = 0;
/** @type {number} */
let trailRafId = 0;
/** @type {TrailMode} */
let trailMode = 'ink';
/** @type {{ x: number; y: number }} */
let trailCursor = { x: 0, y: 0 };
/** @type {EventTarget | null} */
let lastTrailTarget = null;
/** @type {TrailMode | null} */
let lastTrailTargetMode = null;
/** @type {number} */
let dpr = 1;

function cappedDpr() {
  return Math.min(window.devicePixelRatio || 1, MAX_TRAIL_DPR);
}

/** @param {unknown} target @returns {TrailMode} */
function cursorTrailMode(target) {
  if (!(target instanceof Element)) return 'ink';

  if (
    target.closest(
      '.site-locale, .site-nav, .brand, mappy-lightbox[open], .lightbox__dialog, .lightbox__close',
    )
  ) {
    return 'none';
  }

  if (
    target.closest(
      '[data-lightbox], .showcase__shot, .hero__visual, .screenshot-card__frame, .landing-section__figure, .showcase__frame, .screenshot-card img, .hero__visual img, .lightbox__img',
    )
  ) {
    return 'zoom';
  }

  if (
    target.closest(
      '[data-state="waiting"], [aria-busy="true"], .is-waiting, [data-mappy-cursor="wait"], [data-mappy-cursor="progress"]',
    )
  ) {
    return 'none';
  }

  if (
    target.closest(
      '[data-site-drag-handle], [data-mappy-cursor="grab"], [data-mappy-cursor="grabbing"], [data-mappy-cursor="move"], [data-mappy-cursor="all-scroll"]',
    )
  ) {
    return 'none';
  }

  if (
    target.closest(
      'p, li, blockquote, pre, figcaption, dd, dt, h1, h2, h3, h4, h5, h6, td, th, code, .wiki-article, .wiki-article__hook, .wiki-article__footer, .tooltip__body, .tooltip__lead, [data-mappy-selectable-text], .mappy-selectable-text',
    ) &&
    !target.closest(
      'a[href], button, summary, label[for], select, .btn, .chapter-card, .section-drawer__summary, .catalog-highlight, .catalog-highlight__jump, .catalog__filter-pill, .catalog__chapter-toggle, .instrument__toggle, .instrument__wiki-link, .lightbox__close, .footer-links a, .wiki-sidebar__link, [role="button"], [role="link"], [role="tab"]',
    )
  ) {
    return 'none';
  }

  if (
    target.closest(
      'a, button, summary, label[for], select, .btn, .chapter-card, .section-drawer__summary, .catalog-highlight, .catalog-highlight__jump, .catalog__filter-pill, .catalog__chapter-toggle, .instrument__toggle, .instrument__wiki-link, .lightbox__close, .footer-links a, .wiki-sidebar__link, [role="button"], [role="link"], [role="tab"]',
    )
  ) {
    return 'none';
  }

  if (target.closest('.btn--primary, .site-nav__cta, a.btn--primary')) return 'none';

  if (
    target.closest(
      'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, [contenteditable="true"], .catalog__search-input',
    )
  ) {
    return 'none';
  }

  if (target.closest('.rich-help, [data-tip-heading], .mappy-help-underline')) return 'none';

  if (target.closest(':disabled, [aria-disabled="true"], .catalog__filter-pill--disabled')) {
    return 'none';
  }

  return 'ink';
}

/** @param {PointerEvent} e @returns {TrailMode} */
function trailModeForEvent(e) {
  if (e.target === lastTrailTarget && lastTrailTargetMode) return lastTrailTargetMode;
  lastTrailTarget = e.target;
  lastTrailTargetMode = cursorTrailMode(e.target);
  return lastTrailTargetMode;
}

/** @param {TrailMode} mode */
function syncTrailModeAttr(mode) {
  if (trailMode === mode) return;
  trailMode = mode;
  document.documentElement.dataset.inkTrailMode = mode;
}

function syncTrailCanvasSize() {
  if (!trailCanvas || !trailCtx) return;
  dpr = cappedDpr();
  const w = window.innerWidth;
  const h = window.innerHeight;
  trailCanvas.width = Math.floor(w * dpr);
  trailCanvas.height = Math.floor(h * dpr);
  trailCanvas.style.width = `${w}px`;
  trailCanvas.style.height = `${h}px`;
  trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  trailCtx.lineCap = 'round';
  trailCtx.lineJoin = 'round';
  trailCtx.shadowBlur = 0;
}

/** @param {number} now */
function compactTrail(now) {
  while (trailHead < trail.length && now - trail[trailHead].t >= TRAIL_LIFE_MS) {
    trailHead++;
  }
  if (trailHead > 48) {
    trail = trail.slice(trailHead);
    trailHead = 0;
  }
}

/** @param {TrailPoint} point */
function pushTrailPoint(point) {
  trail.push(point);
  const live = trail.length - trailHead;
  if (live > TRAIL_MAX) trailHead++;
}

/** @param {number} startIndex @param {number} now */
function drawInkTrail(startIndex, now) {
  if (!trailCtx || startIndex >= trail.length) return;

  const invLife = 1 / TRAIL_LIFE_MS;

  trailCtx.save();
  trailCtx.lineCap = 'round';
  trailCtx.lineJoin = 'round';
  trailCtx.shadowBlur = 0;

  if (trail.length - startIndex === 1) {
    const p = trail[startIndex];
    const age = (now - p.t) * invLife;
    if (age >= 1) {
      trailCtx.restore();
      return;
    }
    const alpha = (1 - age) ** 1.5 * 0.45;
    trailCtx.fillStyle = `rgba(206, 178, 111, ${alpha})`;
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, 0.55, 0, Math.PI * 2);
    trailCtx.fill();
    trailCtx.restore();
    return;
  }

  for (let i = startIndex + 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const age = (now - a.t) * invLife;
    if (age >= 1) continue;

    const fade = (1 - age) ** 1.45;
    trailCtx.strokeStyle = `rgba(206, 178, 111, ${fade * 0.52})`;
    trailCtx.lineWidth = TRAIL_WIDTH * (0.65 + fade * 0.35);
    trailCtx.beginPath();
    trailCtx.moveTo(a.x, a.y);
    trailCtx.lineTo(b.x, b.y);
    trailCtx.stroke();
  }

  trailCtx.restore();
}

/** @param {number} x @param {number} y @param {number} now */
function drawZoomLensPulse(x, y, now) {
  if (!trailCtx) return;

  const wave = Math.sin(now * 0.0035);
  const pulse = 1 + wave * 0.045;
  const alpha = 0.16 + (wave + 1) * 0.07;

  trailCtx.strokeStyle = `rgba(228, 200, 138, ${alpha})`;
  trailCtx.lineWidth = 1.05;
  trailCtx.beginPath();
  trailCtx.arc(x, y, 9.2 * pulse, 0, Math.PI * 2);
  trailCtx.stroke();
}

function paintTrail() {
  if (!trailCtx || !finePointer.matches || reducedMotion.matches) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  trailCtx.clearRect(0, 0, w, h);
  const now = performance.now();
  compactTrail(now);

  if (trail.length - trailHead > 0) {
    drawInkTrail(trailHead, now);
  }

  if (trailMode === 'zoom') {
    drawZoomLensPulse(trailCursor.x, trailCursor.y, now);
  }
}

function scheduleTrailFrame() {
  if (trailRafId) return;
  trailRafId = requestAnimationFrame(() => {
    trailRafId = 0;
    paintTrail();
    if (trail.length - trailHead > 0 || trailMode === 'zoom') scheduleTrailFrame();
  });
}

/** @param {PointerEvent} e */
function onPointerMove(e) {
  if (!finePointer.matches || reducedMotion.matches || e.pointerType !== 'mouse') return;

  const mode = trailModeForEvent(e);
  syncTrailModeAttr(mode);

  if (mode === 'zoom') {
    trailCursor.x = e.clientX;
    trailCursor.y = e.clientY;
    scheduleTrailFrame();
    return;
  }

  if (mode !== 'ink') {
    scheduleTrailFrame();
    return;
  }

  const pt = { x: e.clientX, y: e.clientY };
  trailCursor = pt;
  const last = trail[trail.length - 1];
  const dx = pt.x - (last?.x ?? 0);
  const dy = pt.y - (last?.y ?? 0);
  if (!last || last.kind !== 'ink' || dx * dx + dy * dy >= TRAIL_MIN_DIST_SQ) {
    pushTrailPoint({ x: pt.x, y: pt.y, t: performance.now(), kind: 'ink' });
    scheduleTrailFrame();
  }
}

function ensureTrailCanvas() {
  let el = document.getElementById('site-ink-trail-canvas');
  if (!(el instanceof HTMLCanvasElement)) {
    el = document.createElement('canvas');
    el.id = 'site-ink-trail-canvas';
    el.className = 'site-ink-trail-canvas';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  trailCanvas = el;
  trailCtx = el.getContext('2d', { alpha: true, desynchronized: true });
}

function init() {
  ensureTrailCanvas();
  if (!trailCtx) return;

  syncTrailCanvasSize();
  window.addEventListener('resize', syncTrailCanvasSize, { passive: true });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.dataset.inkTrailMode = 'ink';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
