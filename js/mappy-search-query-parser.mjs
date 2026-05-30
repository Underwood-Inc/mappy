/**
 * Human-friendly search (AND / OR / quoted phrases / prefix* wildcards).
 *
 * PARITY CONTRACT: this is the browser twin of the canonical
 * `apps/mappy/src/molecules/searchQueryParser.ts` (+ `foldLocaleSearchText`
 * from `mappyLocaleSearchProjection.ts`). The static site has no bundler, so the
 * logic is mirrored here by hand. `src/meta/searchParserParity.test.ts` asserts
 * the two stay equivalent — if you change matching here, change it there too.
 *
 * CLAD tier: Molecule (parity mirror of canonical)
 */

/**
 * Fold accents and punctuation so `découvert` matches `decouvert`.
 * Mirrors `foldLocaleSearchText` in mappyLocaleSearchProjection.ts.
 * @param {string} raw
 */
export function foldSearchText(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['']/g, '')
    .replace(/-/g, '');
}

/** @param {string} query */
export function parseSearchQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { exactPhrases: [], orGroups: [], hasContent: false };
  }

  /** @type {string[]} */
  const exactPhrases = [];
  let processedQuery = trimmed.replace(/"([^"]+)"/g, (_match, phrase) => {
    exactPhrases.push(String(phrase).toLowerCase());
    return '';
  });

  processedQuery = processedQuery.trim();

  /** @type {string[][]} */
  const orGroups = [];

  if (processedQuery) {
    const groups = processedQuery
      .split('|')
      .map((g) => g.trim())
      .filter(Boolean);

    for (const group of groups) {
      const andTerms = group.split(/\s+/).filter(Boolean);
      if (andTerms.length > 0) orGroups.push(andTerms);
    }
  }

  return {
    exactPhrases,
    orGroups,
    hasContent: exactPhrases.length > 0 || orGroups.length > 0,
  };
}

/** @param {string} text @param {string} query */
export function matchesSearchQuery(text, query) {
  const searchText = foldSearchText(text);
  const parsed = parseSearchQuery(query);

  for (const phrase of parsed.exactPhrases) {
    if (!searchText.includes(foldSearchText(phrase))) return false;
  }

  if (parsed.orGroups.length === 0) {
    return parsed.exactPhrases.length > 0;
  }

  return parsed.orGroups.some((orGroup) =>
    orGroup.every((term) => {
      if (term.endsWith('*')) {
        const prefix = foldSearchText(term.slice(0, -1));
        return prefix.length > 0 && searchText.includes(prefix);
      }
      return searchText.includes(foldSearchText(term));
    }),
  );
}

/** @param {string} query */
export function queryLooksAdvanced(query) {
  return /["|*]/.test(query) || /\s+\S+\s+\S+/.test(query);
}
