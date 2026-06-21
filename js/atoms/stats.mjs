/**
 * Locale-aware stat string formatting — pure functions, no DOM queries.
 * CLAD tier: Atom
 */

/** Returns a locale-aware `Intl.NumberFormat` matching the current page locale. */
export function siteNumberFormat() {
  const bcp47 = document.body.dataset.siteLocaleBcp47 || document.documentElement.lang || 'en';
  return new Intl.NumberFormat(bcp47);
}

/**
 * Replaces `{key}` placeholders in `template` with locale-formatted values.
 * @param {string} template
 * @param {Record<string, string | number>} vars
 */
export function fillStatsTemplate(template, vars) {
  const nf = siteNumberFormat();
  return Object.entries(vars).reduce((text, [key, value]) => {
    const formatted = typeof value === 'number' ? nf.format(value) : String(value);
    return text.replaceAll(`{${key}}`, formatted);
  }, template);
}
