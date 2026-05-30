# mappy GitHub Pages landing

Static product intro deployed to **Underwood-Inc/mappy** GitHub Pages.

| Item | Value |
|------|--------|
| **Live URL** | https://underwood-inc.github.io/mappy/ |
| **Source** | `site/` in mappy-internal |
| **Deploy** | Internal **Publish landing site** → pushes rendered `site/` to **`gh-pages`** on **Underwood-Inc/mappy** |

## Architecture (CLAD tiers)

The landing is **generated**: never hand-edit `site/index.html` or `site/locales/*.json` — edit the sources below and run `pnpm site:render`. Source-of-truth lives in `scripts/lib/`; `site/` holds only generated output plus hand-authored styles and runtime scripts.

| Tier | Files | Responsibility |
|------|-------|----------------|
| **Atom** | `scripts/lib/site-linkify.mjs`, `scripts/lib/site-landing-locale.mjs`, `site/scss/_tokens.scss` | Pure transforms / design tokens, no side effects |
| **Molecule (data)** | `scripts/lib/site-landing-meta.mjs` (highlights, glyphs, `SHOWCASE_SHOTS`), `scripts/lib/site-landing-urls.mjs`, `scripts/lib/site-landing-terms.mjs` | Single source of truth for non-translatable catalogs (URLs, glyphs, asset filenames, protected terms) |
| **Molecule (copy)** | `scripts/lib/site-shell-copy-en.mjs` (English source), `scripts/lib/site-copy-locales/*.json` (siblings) | Translatable strings only — never asset paths or URLs |
| **Molecule (html)** | `scripts/lib/site-rich-tooltip-html.mjs` | Pure HTML-string builders (tooltips, body copy) |
| **Organism** | `scripts/lib/render-site-page.mjs` | Assembles copy + meta into page-section HTML |
| **Recipe** | `scripts/render-landing-site.mjs`, `scripts/site-localize*.mjs` | Top-level build: render HTML, write locale bundles, copy `public/` assets into `site/assets/` |
| **View** | `site/js/site-locale.js` | Swaps `#site-content` / header DOM on language change |
| **App** | `site/js/catalog-ui.js` | Runtime behaviour: search, expand/collapse, sticky backdrop, scroll/jump |
| **Shared (browser)** | `site/js/mappy-search-query-parser.js`, `site/js/rich-tooltips.js` | Browser twins of in-app molecules (kept honest by parity tests) |

### File layout

```
site/
  index.html            generated — do not edit
  styles.css            generated from scss/ via `pnpm site:styles`
  scss/                 hand-authored styles (one partial per component)
  js/                   hand-authored runtime scripts (View / App / shared)
  locales/              generated per-locale bundles + manifest
  assets/               icons + showcase screenshots (copied from public/ at render)
```

### Parity contracts

The site has no bundler, so two browser scripts mirror in-app molecules by hand:

- `site/js/mappy-search-query-parser.js` ↔ `src/molecules/searchQueryParser.ts` (+ `foldLocaleSearchText`). Guarded by `src/meta/searchParserParity.test.ts` (`[FR-002]`).

`site/js/catalog-ui.js` depends on a **DOM contract** (the `data-*` attributes and classes emitted by `render-site-page.mjs`); both files carry a comment block listing it — change them together.

## Product name

Always **mappy** (all lowercase) in user-facing copy — never **Mappy**. Canonical constant: `src/atoms/productName.ts` (`PRODUCT_NAME`). UI catalogs use `{productName}` — see `docs/i18n.md`.

## Publish (CI)

**Internal only:** `.github/workflows/publish-landing-site.yml` renders `site/` and pushes to the **`gh-pages`** branch on **Underwood-Inc/mappy** using `PUBLIC_REPO_TOKEN`.

### One-time Pages setting (required)

On **Underwood-Inc/mappy** → **Settings → Pages**:

| Setting | Value |
|---------|--------|
| Source | **Deploy from a branch** |
| Branch | **`gh-pages`** |
| Folder | **`/ (root)`** |

**Do not use `main`.** The public `main` branch only has `README.md` — if Pages deploys from `main`, github.io renders the README instead of the landing site. That is not a workflow failure; it is the wrong branch in Pages settings.

After the setting is correct, run **Actions → Publish landing site** on **mappy-internal** (or push landing changes to `master`). The workflow verifies the live URL serves the landing HTML and fails with instructions if Pages is still misconfigured.

1. **Automatic:** push to `master` on **mappy-internal** when landing sources change.
2. **Manual:** **Actions → Publish landing site** on **mappy-internal**.

Live URL: https://underwood-inc.github.io/mappy/

## Local preview

```powershell
Set-Location path\to\mappy-internal
npx --yes serve site -p 8080
```

Open http://127.0.0.1:8080

## Content source

The instrument catalog is generated from Rowan's canonical list in `scripts/lib/public-marketing-sections.mjs` (same source as the public player README).

```powershell
pnpm site:render
```

## Localization (11 UI languages)

Same incremental fingerprint pipeline as app i18n and the valuation report:

| Piece | Location |
|-------|----------|
| English source (shell + catalog merge) | `scripts/lib/site-shell-copy-en.mjs`, `scripts/lib/site-copy.mjs` |
| Translated siblings | `scripts/lib/site-copy-locales/{locale}.json` |
| Fingerprints | `scripts/lib/site-copy-translation-meta.json` |
| Runtime bundles | `site/locales/{locale}.json` (generated by `pnpm site:render`) |
| Language picker | `site/js/site-locale.js` + header `<select>` |

```powershell
# Incremental translate (LibreTranslate) + render HTML/bundles
pnpm site:localize:refresh

# Offline dev stubs ([es] prefix) + render
pnpm site:localize:refresh:stub

# Full monorepo refresh (UI + game data + valuation + landing)
pnpm l10n:refresh
```

Picker persists `mappy-site-locale` in `localStorage` and falls back to `navigator.languages`. Arabic (`ar`) sets `dir="rtl"` on `<html>`. Brand name stays **`mappy`** via `{productName}` placeholders (not translated).

**Non-translatable URLs** — Windows download CTAs use a **fixed asset name** on the **`updater-index`** release (same channel as the in-app updater): `mappy-windows-setup.exe`. No JavaScript fetch — plain `<a href>` only. The file is refreshed when operators run **Finalize public release** (or **Refresh updater index**). Prose still shows `{downloadShort}` as `short.army/mappy`; linkify maps that label to the stable GitHub URL at render time.

**Protected terms** — `{uiLanguageCount}` (English renders **Eleven**, other locales **11**), `{worldData}`, `{scratchPins}`, `{whiteboardPins}`, and `{yourMachine}` (locale glossary in `scripts/lib/site-landing-terms.mjs`) avoid LibreTranslate mangling product vocabulary.

**Locale numbers** — chapter counts, catalog intro totals, guild-favorite `{count}`, and search stats use `Intl.NumberFormat` via `scripts/lib/site-landing-locale.mjs` (BCP-47 from `src/i18n/supported-locales.json`). Client stats bar reads `data-site-locale-bcp47` on `<body>`.

That rewrites `index.html` with all **15 chapters** and **82 instruments**. Presentation:

- **Chapter deck** — 15 scannable tiles (glyph + kao + count) jump to a section
- **Collapsible drawers** — one chapter open at a time by default; expand/collapse all in the toolbar
- **Sticky search** — same syntax as in-app HUD search (`"phrase"`, AND, `|`, `prefix*`) via `site/js/mappy-search-query-parser.js` + `site/js/catalog-ui.js`; filters instruments, section drawers, **chapter deck cards**, and guild-favorite tiles together
- **Guild favorites** — eight high-impact instruments (names in `site-landing-meta.mjs` → `CATALOG_HIGHLIGHT_NAMES`, resolved from the marketing catalog)
- **Spotlight** — headline card per chapter; remaining features are compact **atlas rows** (peek line + expand for detail)

Section blurbs and glyphs: `scripts/lib/site-landing-meta.mjs`. Edit `styles.css` by hand; edit marketing copy in `public-marketing-sections.mjs`, then re-run render.

## Visual design

Colors and dot-grid background match `src/ui/foundation/tokens.css` (warm parchment HUD — not light beige / forest green).

## Rich tooltips

Mentor tooltips match the in-app `mappy-help-tooltip` pattern (same as traceability HTML reports):

- **Dotted underline** — inline terms (hero, pillars, trust, section titles, field labels).
- **? badge** — every instrument title in the catalog (hover or keyboard focus for heading + how + tips).
- Client script: `site/js/rich-tooltips.js` (included from generated `index.html`).
- Trigger helpers: `scripts/lib/site-rich-tooltip-html.mjs` (used by `pnpm site:render`).

## Edit checklist

- [ ] Copy uses **mappy** (lowercase) only
- [ ] Download CTA → stable `updater-index/mappy-windows-setup.exe` (refreshed on finalize)
- [ ] Wiki / README / issues links unchanged
- [ ] After catalog edits: `pnpm site:render` locally (optional; CI renders on publish)
