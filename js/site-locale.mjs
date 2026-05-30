/**
 * GitHub Pages landing locale picker — loads site/locales/{id}.json bundles.
 * CLAD tier: Organism (locale orchestration for the whole page)
 */

const STORAGE_KEY = 'mappy-site-locale';
const headerNav = document.getElementById('site-header-nav');
const siteContent = document.getElementById('site-content');
const select = document.getElementById('site-locale-select');
const localeLabel = document.getElementById('site-locale-label');

/** @type {{ baseLocale: string; storageKey: string; locales: { id: string; label: string; direction: string; bcp47?: string }[] } | null} */
let manifest = null;

/** @param {string} tag */
function coerceLocaleId(tag) {
  if (!tag?.trim() || !manifest) return manifest.baseLocale;
  const normalized = tag.trim().toLowerCase();
  if (manifest.locales.some((row) => row.id === normalized)) return normalized;
  const primary = normalized.split('-')[0] ?? '';
  if (manifest.locales.some((row) => row.id === primary)) return primary;
  if (primary === 'zh') return 'zh';
  return manifest.baseLocale;
}

function resolveInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && manifest?.locales.some((row) => row.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  const nav = navigator.languages ?? [navigator.language ?? 'en'];
  for (const tag of nav) {
    const id = coerceLocaleId(tag);
    if (id) return id;
  }
  return manifest?.baseLocale ?? 'en';
}

/** @param {string} localeId */
async function fetchBundle(localeId) {
  const res = await fetch(`locales/${localeId}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load locale bundle: ${localeId}`);
  return res.json();
}

/** @param {{ meta: { title: string; description: string; ogTitle: string; ogDescription: string }; headerNav: string; body: string; catalog?: { statsDefault?: string; statsFiltered?: string; totalInstruments?: number; totalChapters?: number }; ui?: { localeLabel?: string; skipLink?: string } }} bundle */
function applyBundle(bundle) {
  const meta = bundle.meta;
  if (headerNav) headerNav.innerHTML = bundle.headerNav;
  if (siteContent) siteContent.innerHTML = bundle.body;

  document.title = meta.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', meta.description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', meta.ogTitle);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', meta.ogDescription);

  if (bundle.catalog?.statsDefault) {
    document.body.dataset.siteStatsDefault = bundle.catalog.statsDefault;
  }
  if (bundle.catalog?.statsFiltered) {
    document.body.dataset.siteStatsFiltered = bundle.catalog.statsFiltered;
  }
  if (bundle.catalog?.totalInstruments != null) {
    document.body.dataset.siteTotalInstruments = String(bundle.catalog.totalInstruments);
  }
  if (bundle.catalog?.totalChapters != null) {
    document.body.dataset.siteTotalChapters = String(bundle.catalog.totalChapters);
  }

  if (bundle.ui?.localeLabel && localeLabel) {
    localeLabel.textContent = bundle.ui.localeLabel;
  }
  const skip = document.querySelector('.skip-link');
  if (skip && bundle.ui?.skipLink) skip.textContent = bundle.ui.skipLink;

  window.dispatchEvent(new CustomEvent('site-locale-applied'));
}

/** @param {string} localeId */
async function applyLocale(localeId) {
  if (!manifest) return;
  const row = manifest.locales.find((l) => l.id === localeId);
  if (!row) return;

  const bundle = await fetchBundle(localeId);
  applyBundle(bundle);

  document.documentElement.lang = localeId;
  document.documentElement.dir = row.direction === 'rtl' ? 'rtl' : 'ltr';
  if (row.bcp47) {
    document.body.dataset.siteLocaleBcp47 = row.bcp47;
  }

  if (select) select.value = localeId;
  try {
    localStorage.setItem(STORAGE_KEY, localeId);
  } catch {
    /* ignore */
  }
}

function initLocaleSelect() {
  if (!select || !manifest) return;
  select.innerHTML = '';
  for (const row of manifest.locales) {
    const opt = document.createElement('option');
    opt.value = row.id;
    opt.textContent = row.label;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    applyLocale(select.value).catch((err) => console.error(err));
  });
}

async function init() {
  const manifestRes = await fetch('locales/manifest.json', { cache: 'no-cache' });
  if (!manifestRes.ok) throw new Error('Failed to load locales/manifest.json');
  manifest = await manifestRes.json();
  initLocaleSelect();
  const initial = resolveInitialLocale();
  if (initial === 'en') {
    if (select) select.value = 'en';
    const enRow = manifest.locales.find((row) => row.id === 'en');
    if (enRow?.bcp47) document.body.dataset.siteLocaleBcp47 = enRow.bcp47;
    return;
  }
  await applyLocale(initial);
}

init().catch((err) => console.error(err));
