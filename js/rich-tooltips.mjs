/**
 * Rich mentor tooltips for the mappy GitHub Pages landing.
 * Mirrors `mappy-help-tooltip` surface markup and `data-tip-*` content shape.
 * CLAD tier: Organism (self-contained tooltip system)
 */

const SHOW_MS = 140;
const HIDE_MS = 180;
/** @type {HTMLElement | null} */
let surface = null;
/** @type {HTMLElement | null} */
let active = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let showTimer;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let hideTimer;

/** @param {HTMLElement} el */
function parseBullets(el) {
  const raw = el.getAttribute('data-tip-bullets');
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

const DOWNLOAD_URL = 'https://short.army/mappy';
const HTTPS_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const SHORT_DOWNLOAD_RE = /(?<!https:\/\/)short\.army\/mappy/gi;

/** @param {string} text @returns {{ i: number, len: number, href: string, label: string }[]} */
function linkSpans(text) {
  /** @type {{ i: number, len: number, href: string, label: string }[]} */
  const hits = [];
  let m;
  HTTPS_RE.lastIndex = 0;
  while ((m = HTTPS_RE.exec(text)) !== null) {
    hits.push({ i: m.index, len: m[0].length, href: m[0], label: m[0] });
  }
  SHORT_DOWNLOAD_RE.lastIndex = 0;
  while ((m = SHORT_DOWNLOAD_RE.exec(text)) !== null) {
    const start = m.index;
    if (hits.some((h) => start >= h.i && start < h.i + h.len)) continue;
    hits.push({ i: start, len: m[0].length, href: DOWNLOAD_URL, label: m[0] });
  }
  hits.sort((a, b) => a.i - b.i);
  return hits;
}

/** @param {string} text */
function stripHtmlTags(text) {
  return String(text).replace(/<[^>]+>/g, '');
}

/** @param {HTMLElement} parent @param {string} text */
function appendPlainWithLinks(parent, text) {
  const hits = linkSpans(text);
  let last = 0;
  for (const hit of hits) {
    if (hit.i > last) parent.appendChild(document.createTextNode(text.slice(last, hit.i)));
    const a = document.createElement('a');
    a.href = hit.href;
    a.textContent = hit.label;
    a.rel = 'noopener noreferrer';
    parent.appendChild(a);
    last = hit.i + hit.len;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

/** @param {HTMLElement} parent @param {string} text */
function appendInlineMarkup(parent, text) {
  const src = String(text);
  const re = /`([^`]+)`|<(em|strong)>([^<]*)<\/\2>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) appendPlainWithLinks(parent, src.slice(last, m.index));
    if (m[1] !== undefined) {
      const code = document.createElement('code');
      code.className = 'mappy-help-tooltip__code';
      code.textContent = m[1];
      parent.appendChild(code);
    } else {
      const el = document.createElement(m[2].toLowerCase());
      appendPlainWithLinks(el, m[3]);
      parent.appendChild(el);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) appendPlainWithLinks(parent, src.slice(last));
}

/** @param {HTMLElement} parent @param {string} text */
function appendRichText(parent, text) {
  appendInlineMarkup(parent, text);
}

function ensureSurface() {
  if (surface) return surface;
  const el = document.createElement('div');
  el.id = 'mappy-rich-tip';
  el.className = 'mappy-help-tooltip__surface';
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  el.innerHTML =
    '<strong class="mappy-help-tooltip__title"></strong><div class="mappy-help-tooltip__main"></div>';
  document.body.appendChild(el);
  el.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  el.addEventListener('pointerleave', () => scheduleHide());
  surface = el;
  return el;
}

/** @param {HTMLElement} trigger */
function fillSurface(trigger) {
  const tip = ensureSurface();
  const heading = trigger.getAttribute('data-tip-heading') || 'Help';
  const hint = trigger.getAttribute('data-tip-hint') || '';
  const bullets = parseBullets(trigger);
  const titleEl = tip.querySelector('.mappy-help-tooltip__title');
  if (titleEl) titleEl.textContent = stripHtmlTags(heading);
  const main = tip.querySelector('.mappy-help-tooltip__main');
  if (!main) return;
  main.replaceChildren();

  if (bullets.length === 0) {
    const p = document.createElement('p');
    p.className = 'mappy-help-tooltip__body';
    appendRichText(p, hint || heading);
    main.appendChild(p);
    return;
  }

  if (hint) {
    const intro = document.createElement('p');
    intro.className = 'mappy-help-tooltip__lead';
    appendRichText(intro, hint);
    main.appendChild(intro);
  }

  const ul = document.createElement('ul');
  ul.className = 'mappy-help-tooltip__list';
  for (const line of bullets) {
    const li = document.createElement('li');
    appendRichText(li, line);
    ul.appendChild(li);
  }
  main.appendChild(ul);
}

/** @param {HTMLElement} trigger @param {HTMLElement} tip */
function positionSurface(trigger, tip) {
  const r = trigger.getBoundingClientRect();
  const pad = 8;
  const gap = 8;
  tip.style.visibility = 'hidden';
  tip.hidden = false;
  const sw = tip.offsetWidth;
  const sh = tip.offsetHeight;
  let top = r.bottom + gap;
  if (top + sh > window.innerHeight - pad && r.top - gap - sh > pad) {
    top = r.top - gap - sh;
  }
  let left = r.left + r.width / 2 - sw / 2;
  left = Math.min(Math.max(pad, left), window.innerWidth - pad - sw);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.style.visibility = '';
}

/** @param {boolean} [immediate] */
function hide(immediate) {
  clearTimeout(showTimer);
  if (immediate) {
    clearTimeout(hideTimer);
    if (surface) {
      surface.hidden = true;
      surface.style.visibility = 'hidden';
    }
    active = null;
    return;
  }
  hideTimer = setTimeout(() => {
    if (surface) {
      surface.hidden = true;
      surface.style.visibility = 'hidden';
    }
    active = null;
  }, HIDE_MS);
}

function scheduleHide() {
  hide(false);
}

/** @param {HTMLElement} el */
function show(el) {
  clearTimeout(hideTimer);
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    active = el;
    fillSurface(el);
    const tip = ensureSurface();
    positionSurface(el, tip);
    requestAnimationFrame(() => {
      if (active === el && surface) positionSurface(el, surface);
    });
  }, SHOW_MS);
}

document.addEventListener(
  'mouseover',
  (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const el = target.closest?.('.rich-help');
    if (el instanceof HTMLElement) {
      show(el);
      return;
    }
    if (!target.closest?.('#mappy-rich-tip')) scheduleHide();
  },
  true,
);

document.addEventListener('focusin', (e) => {
  const el = /** @type {HTMLElement} */ (e.target).closest?.('.rich-help');
  if (el instanceof HTMLElement) show(el);
});

document.addEventListener('focusout', (e) => {
  const el = /** @type {HTMLElement} */ (e.target).closest?.('.rich-help');
  if (el instanceof HTMLElement && !el.contains(/** @type {Node} */ (e.relatedTarget))) {
    scheduleHide();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hide(true);
});

const reposition = () => {
  if (active && surface) positionSurface(active, surface);
};
window.addEventListener('scroll', reposition, { passive: true, capture: true });
window.addEventListener('resize', reposition);
