/**
 * Inline text highlighting — wraps matching substrings in <mark class="search-mark">.
 * Works on live DOM text nodes; safe to call repeatedly (clears previous marks first).
 * CLAD tier: Atom
 */

/**
 * Remove all existing `.search-mark` elements inside `root`, merging their
 * text back into plain text nodes.
 * @param {Element} root
 */
export function clearHighlight(root) {
  for (const mark of root.querySelectorAll('.search-mark')) {
    mark.replaceWith(mark.textContent ?? '');
  }
  root.normalize();
}

/**
 * Highlight every occurrence of each term inside `root`'s text nodes.
 * Case-insensitive, safe against HTML injection.
 * @param {Element} root
 * @param {string[]} terms  Plain strings to highlight (no regex meta).
 */
export function applyHighlight(root, terms) {
  clearHighlight(root);
  const filtered = terms.filter(Boolean);
  if (!filtered.length) return;

  const pattern = new RegExp(
    `(${filtered.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );

  // Collect all text nodes first — mutating during traversal breaks the walker.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const nodes = [];
  let n;
  while ((n = /** @type {Text} */ (walker.nextNode()))) nodes.push(n);

  for (const textNode of nodes) {
    if (!textNode.parentNode) continue;
    const text = textNode.textContent ?? '';
    pattern.lastIndex = 0;
    if (!pattern.test(text)) continue;
    pattern.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.className = 'search-mark';
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

/**
 * Extract plain highlight terms from a raw query string.
 * Strips prefix wildcards (*), returns individual words and quoted phrases.
 * @param {string} query
 * @returns {string[]}
 */
export function termsFromQuery(query) {
  const terms = [];
  // Extract quoted phrases first.
  const withoutPhrases = query.replace(/"([^"]+)"/g, (_, p) => { terms.push(p); return ''; });
  // Remaining pipe-separated words.
  for (const group of withoutPhrases.split('|')) {
    for (const word of group.trim().split(/\s+/)) {
      const w = word.replace(/\*$/, '').trim();
      if (w) terms.push(w);
    }
  }
  return terms;
}
