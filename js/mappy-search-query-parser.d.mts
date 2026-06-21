/**
 * Type declarations for the browser-twin search parser.
 * Mirrors the exports of mappy-search-query-parser.mjs so TypeScript can
 * type-check the parity test at src/meta/searchParserParity.test.ts.
 */

export interface ParsedSearchQuery {
  exactPhrases: string[];
  orGroups: string[][];
  hasContent: boolean;
}

export declare function foldSearchText(raw: string): string;
export declare function parseSearchQuery(query: string): ParsedSearchQuery;
export declare function matchesSearchQuery(text: string, query: string): boolean;
export declare function queryLooksAdvanced(query: string): boolean;
