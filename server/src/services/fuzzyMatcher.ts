/**
 * Fuzzy Matching Utilities
 * 
 * Provides typo-tolerant, case-insensitive, synonym-aware matching
 */

export interface MatchResult {
  score: number; // 0-1, higher is better
  matchedText: string;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'synonym';
}

/**
 * Calculate Levenshtein distance (edit distance)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) using Levenshtein distance
 */
function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Common aliases/synonyms mapping
 */
const ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript', 'es6', 'es2015'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  'node.js': ['nodejs', 'node'],
  'c++': ['cpp', 'cplusplus'],
  'c#': ['csharp', 'c-sharp'],
  'html5': ['html'],
  'css3': ['css'],
  'ui/ux': ['ui', 'ux', 'user interface', 'user experience'],
  'full stack': ['fullstack', 'full-stack'],
  'front end': ['frontend', 'front-end'],
  'back end': ['backend', 'back-end'],
  'machine learning': ['ml', 'machinelearning'],
  'artificial intelligence': ['ai'],
  'data science': ['datascience'],
  'devops': ['dev-ops'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  'api': ['rest api', 'restful api'],
  'sql': ['structured query language'],
  'nosql': ['no sql'],
  'ui design': ['ui', 'interface design'],
  'ux design': ['ux', 'user experience design'],
};

/**
 * Reverse alias map (alias -> canonical)
 */
const REVERSE_ALIASES: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    REVERSE_ALIASES.set(alias.toLowerCase(), canonical.toLowerCase());
  }
}

/**
 * Normalize text for matching
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Get canonical form of a term (resolve aliases)
 */
export function getCanonical(term: string): string {
  const normalized = normalizeText(term);
  return REVERSE_ALIASES.get(normalized) || normalized;
}

/**
 * Fuzzy match query against target text
 */
export function fuzzyMatch(query: string, target: string): MatchResult {
  const queryNorm = normalizeText(query);
  const targetNorm = normalizeText(target);
  const queryCanonical = getCanonical(query);
  const targetCanonical = getCanonical(target);

  // Exact match (case-insensitive)
  if (queryNorm === targetNorm) {
    return { score: 1.0, matchedText: target, matchType: 'exact' };
  }

  // Canonical match (synonym)
  if (queryCanonical === targetCanonical && queryCanonical !== queryNorm) {
    return { score: 0.95, matchedText: target, matchType: 'synonym' };
  }

  // Prefix match
  if (targetNorm.startsWith(queryNorm)) {
    const prefixScore = queryNorm.length / targetNorm.length;
    return { score: 0.7 + prefixScore * 0.2, matchedText: target, matchType: 'prefix' };
  }

  // Contains match
  if (targetNorm.includes(queryNorm)) {
    const containsScore = queryNorm.length / targetNorm.length;
    return { score: 0.5 + containsScore * 0.2, matchedText: target, matchType: 'contains' };
  }

  // Fuzzy match (Levenshtein)
  const sim = similarity(queryNorm, targetNorm);
  if (sim > 0.7) {
    return { score: sim * 0.8, matchedText: target, matchType: 'fuzzy' };
  }

  // Check if query matches any part of target (word-level)
  const queryWords = queryNorm.split(/\s+/);
  const targetWords = targetNorm.split(/\s+/);
  let wordMatches = 0;
  for (const qWord of queryWords) {
    for (const tWord of targetWords) {
      if (tWord.includes(qWord) || similarity(qWord, tWord) > 0.8) {
        wordMatches++;
        break;
      }
    }
  }
  if (wordMatches > 0) {
    const wordScore = wordMatches / queryWords.length;
    return { score: wordScore * 0.6, matchedText: target, matchType: 'fuzzy' };
  }

  return { score: 0, matchedText: target, matchType: 'fuzzy' };
}

/**
 * Check if query matches target (with threshold)
 */
export function matches(query: string, target: string, threshold: number = 0.3): boolean {
  const result = fuzzyMatch(query, target);
  return result.score >= threshold;
}

/**
 * Find best matches from a list
 */
export function findBestMatches(
  query: string,
  candidates: string[],
  limit: number = 20,
  threshold: number = 0.3
): Array<{ text: string; score: number; matchType: string }> {
  const results = candidates
    .map(candidate => {
      const match = fuzzyMatch(query, candidate);
      return {
        text: candidate,
        score: match.score,
        matchType: match.matchType,
      };
    })
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

