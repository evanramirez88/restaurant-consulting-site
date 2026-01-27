/**
 * Entity Resolution Service
 * 
 * Provides similarity scoring algorithms and entity matching logic
 * for the deduplication system.
 * 
 * Features:
 * - Levenshtein distance for fuzzy string matching
 * - Phonetic matching (Soundex, Double Metaphone)
 * - Weighted confidence scoring
 * - Auto-merge vs manual review thresholds
 * - Normalization utilities
 */

// =====================================================
// CONFIGURATION & TYPES
// =====================================================

export interface MatchResult {
  entity1Id: string;
  entity2Id: string;
  confidence: number;
  matchedFields: FieldMatch[];
  recommendation: 'auto_merge' | 'review' | 'ignore';
}

export interface FieldMatch {
  field: string;
  value1: string;
  value2: string;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'normalized';
  weight: number;
}

export interface MatchConfig {
  autoMergeThreshold: number;   // >= this: auto merge
  reviewThreshold: number;      // >= this: needs review
  ignoreThreshold: number;      // < this: not a match
  fieldWeights: Record<string, number>;
  usePhonetic: boolean;
  useFuzzy: boolean;
}

export const DEFAULT_CONFIG: MatchConfig = {
  autoMergeThreshold: 0.95,
  reviewThreshold: 0.70,
  ignoreThreshold: 0.50,
  fieldWeights: {
    email: 1.0,
    phone: 0.8,
    company_name: 0.7,
    name: 0.6,
    address: 0.5,
    city: 0.3,
    state: 0.2
  },
  usePhonetic: true,
  useFuzzy: true
};

// =====================================================
// NORMALIZATION UTILITIES
// =====================================================

/**
 * Normalize email address
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Normalize phone number (remove all non-digits)
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Handle US numbers with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}

/**
 * Normalize company/person name
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Collapse whitespace
    // Remove common suffixes
    .replace(/\s+(llc|inc|corp|co|ltd|restaurant|bar|grill|cafe|pub|tavern|bistro|kitchen)\.?$/i, '')
    .trim();
}

/**
 * Normalize address for comparison
 */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .trim()
    // Standardize common abbreviations
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bsuite\b/g, 'ste')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// STRING SIMILARITY ALGORITHMS
// =====================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create distance matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill in the rest
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio using Levenshtein distance (0-1)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Jaro-Winkler similarity (better for short strings like names)
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification: boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Soundex phonetic encoding
 */
export function soundex(str: string): string {
  if (!str) return '';
  
  const s = str.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';

  const codes: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6'
  };

  let result = s[0].toUpperCase();
  let prevCode = codes[s[0]] || '';

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = codes[s[i]] || '';
    if (code && code !== prevCode) {
      result += code;
    }
    prevCode = code || prevCode;
  }

  return result.padEnd(4, '0');
}

/**
 * Double Metaphone for better phonetic matching
 * Returns [primary, alternate] encodings
 */
export function doubleMetaphone(str: string): [string, string] {
  if (!str) return ['', ''];
  
  const word = str.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return ['', ''];

  // Simplified Double Metaphone implementation
  let primary = '';
  let secondary = '';
  let current = 0;
  const length = word.length;

  // Skip initial silent consonants
  if (['gn', 'kn', 'pn', 'wr', 'ps'].some(p => word.startsWith(p))) {
    current++;
  }

  // Handle initial X
  if (word[0] === 'x') {
    primary = 'S';
    secondary = 'S';
    current++;
  }

  while (current < length && (primary.length < 4 || secondary.length < 4)) {
    const char = word[current];
    const next = word[current + 1] || '';
    const prev = current > 0 ? word[current - 1] : '';

    switch (char) {
      case 'a': case 'e': case 'i': case 'o': case 'u': case 'y':
        if (current === 0) {
          primary += 'A';
          secondary += 'A';
        }
        current++;
        break;

      case 'b':
        primary += 'P';
        secondary += 'P';
        current += (next === 'b') ? 2 : 1;
        break;

      case 'c':
        if (next === 'h') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else if (['e', 'i', 'y'].includes(next)) {
          primary += 'S';
          secondary += 'S';
          current++;
        } else {
          primary += 'K';
          secondary += 'K';
          current++;
        }
        break;

      case 'd':
        if (next === 'g' && ['e', 'i', 'y'].includes(word[current + 2])) {
          primary += 'J';
          secondary += 'J';
          current += 2;
        } else {
          primary += 'T';
          secondary += 'T';
          current += (next === 'd') ? 2 : 1;
        }
        break;

      case 'f':
        primary += 'F';
        secondary += 'F';
        current += (next === 'f') ? 2 : 1;
        break;

      case 'g':
        if (next === 'h') {
          if (!['a', 'e', 'i', 'o', 'u'].includes(prev)) {
            primary += 'K';
            secondary += 'K';
          }
          current += 2;
        } else if (['e', 'i', 'y'].includes(next)) {
          primary += 'J';
          secondary += 'K';
          current++;
        } else {
          primary += 'K';
          secondary += 'K';
          current += (next === 'g') ? 2 : 1;
        }
        break;

      case 'h':
        if (['a', 'e', 'i', 'o', 'u'].includes(next) && !['a', 'e', 'i', 'o', 'u'].includes(prev)) {
          primary += 'H';
          secondary += 'H';
        }
        current++;
        break;

      case 'j':
        primary += 'J';
        secondary += 'J';
        current++;
        break;

      case 'k':
        primary += 'K';
        secondary += 'K';
        current += (next === 'k') ? 2 : 1;
        break;

      case 'l':
        primary += 'L';
        secondary += 'L';
        current += (next === 'l') ? 2 : 1;
        break;

      case 'm':
        primary += 'M';
        secondary += 'M';
        current += (next === 'm') ? 2 : 1;
        break;

      case 'n':
        primary += 'N';
        secondary += 'N';
        current += (next === 'n') ? 2 : 1;
        break;

      case 'p':
        if (next === 'h') {
          primary += 'F';
          secondary += 'F';
          current += 2;
        } else {
          primary += 'P';
          secondary += 'P';
          current += (next === 'p') ? 2 : 1;
        }
        break;

      case 'q':
        primary += 'K';
        secondary += 'K';
        current++;
        break;

      case 'r':
        primary += 'R';
        secondary += 'R';
        current += (next === 'r') ? 2 : 1;
        break;

      case 's':
        if (next === 'h') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else {
          primary += 'S';
          secondary += 'S';
          current += (next === 's') ? 2 : 1;
        }
        break;

      case 't':
        if (next === 'h') {
          primary += '0';
          secondary += 'T';
          current += 2;
        } else if (word.substring(current, current + 4) === 'tion') {
          primary += 'X';
          secondary += 'X';
          current += 4;
        } else {
          primary += 'T';
          secondary += 'T';
          current += (next === 't') ? 2 : 1;
        }
        break;

      case 'v':
        primary += 'F';
        secondary += 'F';
        current++;
        break;

      case 'w':
        if (['a', 'e', 'i', 'o', 'u'].includes(next)) {
          primary += 'W';
          secondary += 'W';
        }
        current++;
        break;

      case 'x':
        primary += 'KS';
        secondary += 'KS';
        current++;
        break;

      case 'z':
        primary += 'S';
        secondary += 'S';
        current += (next === 'z') ? 2 : 1;
        break;

      default:
        current++;
    }
  }

  return [primary.substring(0, 4), secondary.substring(0, 4)];
}

/**
 * Check if two strings match phonetically
 */
export function phoneticMatch(str1: string, str2: string): boolean {
  if (!str1 || !str2) return false;
  
  // Check Soundex
  if (soundex(str1) === soundex(str2)) return true;
  
  // Check Double Metaphone
  const [p1, s1] = doubleMetaphone(str1);
  const [p2, s2] = doubleMetaphone(str2);
  
  return p1 === p2 || p1 === s2 || s1 === p2 || s1 === s2;
}

// =====================================================
// MAIN MATCHING FUNCTIONS
// =====================================================

/**
 * Calculate similarity between two field values
 */
export function calculateFieldSimilarity(
  field: string,
  value1: string | null | undefined,
  value2: string | null | undefined,
  config: MatchConfig
): FieldMatch | null {
  if (!value1 || !value2) return null;

  let normalized1: string;
  let normalized2: string;
  let similarity: number;
  let matchType: 'exact' | 'fuzzy' | 'phonetic' | 'normalized' = 'fuzzy';

  // Normalize based on field type
  switch (field) {
    case 'email':
      normalized1 = normalizeEmail(value1);
      normalized2 = normalizeEmail(value2);
      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else {
        // Emails should be exact match only
        return null;
      }
      break;

    case 'phone':
      normalized1 = normalizePhone(value1);
      normalized2 = normalizePhone(value2);
      if (!normalized1 || !normalized2 || normalized1.length < 10 || normalized2.length < 10) {
        return null;
      }
      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else if (normalized1.endsWith(normalized2) || normalized2.endsWith(normalized1)) {
        // Handle partial phone matches (last 10 digits)
        similarity = 0.9;
        matchType = 'normalized';
      } else {
        return null;
      }
      break;

    case 'company_name':
    case 'name':
      normalized1 = normalizeName(value1);
      normalized2 = normalizeName(value2);
      if (!normalized1 || !normalized2) return null;

      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else if (config.usePhonetic && phoneticMatch(normalized1, normalized2)) {
        similarity = 0.85;
        matchType = 'phonetic';
      } else if (config.useFuzzy) {
        similarity = jaroWinklerSimilarity(normalized1, normalized2);
        matchType = 'fuzzy';
      } else {
        return null;
      }
      break;

    case 'address':
      normalized1 = normalizeAddress(value1);
      normalized2 = normalizeAddress(value2);
      if (!normalized1 || !normalized2) return null;

      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else if (config.useFuzzy) {
        similarity = levenshteinSimilarity(normalized1, normalized2);
        matchType = 'fuzzy';
      } else {
        return null;
      }
      break;

    case 'city':
    case 'state':
      normalized1 = value1.toLowerCase().trim();
      normalized2 = value2.toLowerCase().trim();
      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else {
        return null;
      }
      break;

    default:
      normalized1 = value1.toLowerCase().trim();
      normalized2 = value2.toLowerCase().trim();
      if (normalized1 === normalized2) {
        similarity = 1.0;
        matchType = 'exact';
      } else if (config.useFuzzy) {
        similarity = levenshteinSimilarity(normalized1, normalized2);
        matchType = 'fuzzy';
      } else {
        return null;
      }
  }

  return {
    field,
    value1,
    value2,
    similarity,
    matchType,
    weight: config.fieldWeights[field] || 0.5
  };
}

/**
 * Calculate overall match confidence between two entities
 */
export function calculateMatchConfidence(
  entity1: Record<string, unknown>,
  entity2: Record<string, unknown>,
  fields: string[],
  config: MatchConfig = DEFAULT_CONFIG
): MatchResult {
  const matchedFields: FieldMatch[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const field of fields) {
    const value1 = entity1[field] as string | null | undefined;
    const value2 = entity2[field] as string | null | undefined;

    const fieldMatch = calculateFieldSimilarity(field, value1, value2, config);
    
    if (fieldMatch && fieldMatch.similarity >= 0.5) {
      matchedFields.push(fieldMatch);
      totalWeight += fieldMatch.weight;
      weightedSum += fieldMatch.similarity * fieldMatch.weight;
    }
  }

  const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let recommendation: 'auto_merge' | 'review' | 'ignore';
  if (confidence >= config.autoMergeThreshold) {
    recommendation = 'auto_merge';
  } else if (confidence >= config.reviewThreshold) {
    recommendation = 'review';
  } else {
    recommendation = 'ignore';
  }

  return {
    entity1Id: entity1.id as string,
    entity2Id: entity2.id as string,
    confidence,
    matchedFields,
    recommendation
  };
}

/**
 * Find potential duplicates in a list of entities
 */
export function findDuplicates(
  entities: Record<string, unknown>[],
  fields: string[],
  config: MatchConfig = DEFAULT_CONFIG
): MatchResult[] {
  const results: MatchResult[] = [];

  // Compare each pair (O(n²) but necessary for thorough checking)
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const match = calculateMatchConfidence(entities[i], entities[j], fields, config);
      
      if (match.confidence >= config.ignoreThreshold && match.matchedFields.length > 0) {
        results.push(match);
      }
    }
  }

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Merge two entity records, preferring non-null values from canonical
 */
export function mergeEntities<T extends Record<string, unknown>>(
  canonical: T,
  merged: T,
  preferCanonical: string[] = ['id', 'created_at']
): T {
  const result = { ...canonical };

  for (const key of Object.keys(merged)) {
    // Skip fields that should always come from canonical
    if (preferCanonical.includes(key)) continue;

    const canonicalValue = canonical[key];
    const mergedValue = merged[key];

    // If canonical is null/empty but merged has value, use merged
    if ((canonicalValue === null || canonicalValue === undefined || canonicalValue === '') &&
        (mergedValue !== null && mergedValue !== undefined && mergedValue !== '')) {
      (result as Record<string, unknown>)[key] = mergedValue;
    }
  }

  return result;
}

/**
 * Calculate data completeness score (0-100)
 */
export function calculateCompleteness(
  entity: Record<string, unknown>,
  requiredFields: string[],
  optionalFields: string[] = []
): number {
  let score = 0;
  let maxScore = 0;

  // Required fields worth 10 points each
  for (const field of requiredFields) {
    maxScore += 10;
    if (entity[field] !== null && entity[field] !== undefined && entity[field] !== '') {
      score += 10;
    }
  }

  // Optional fields worth 5 points each
  for (const field of optionalFields) {
    maxScore += 5;
    if (entity[field] !== null && entity[field] !== undefined && entity[field] !== '') {
      score += 5;
    }
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Configuration
  DEFAULT_CONFIG,
  
  // Normalization
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeAddress,
  
  // Similarity algorithms
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  soundex,
  doubleMetaphone,
  phoneticMatch,
  
  // Matching
  calculateFieldSimilarity,
  calculateMatchConfidence,
  findDuplicates,
  
  // Utilities
  mergeEntities,
  calculateCompleteness
};
