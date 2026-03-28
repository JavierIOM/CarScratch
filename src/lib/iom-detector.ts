// Isle of Man registration plate patterns
// Manx plates use letter combinations ending in MN, MAN, or MANX
// Examples: PMN 147 E, MAN 123, MANX 2, 1-MN-00, AMN 1A

const IOM_PATTERNS = [
  // Classic format: [A-Z]MN followed by numbers and optional letter
  // e.g., PMN 147 E, AMN 123, BMN 456 A
  /^([A-Z])MN\s*\d+\s*[A-Z]?$/i,

  // MAN prefix: MAN followed by numbers and optional letter suffix
  // e.g., MAN 123, MAN 1, MAN 6 F, MAN 7 F
  /^MAN\s*\d+\s*[A-Z]?$/i,

  // Number + MAN suffix: e.g., C2 MAN, A1 MAN, B3 MAN
  /^[A-Z]\d+\s*MAN$/i,

  // MANX prefix: MANX followed by numbers and optional letter suffix
  // e.g., MANX 1, MANX 2, MANX 100 A
  /^MANX\s*\d+\s*[A-Z]?$/i,

  // MN followed by numbers (no letter prefix): MN 1, MN 12, MN 123
  /^MN\s*\d+\s*[A-Z]?$/i,

  // Modern format: number-MN-number
  // e.g., 1-MN-00, 123-MN-456
  /^\d+-MN-\d+$/i,

  // Numbers followed by MN-containing suffix: 79NMN, 123MN, 45BMN
  // e.g., 79-NMN, 79NMN, 123MN
  /^\d+\s*[A-Z]?MN[A-Z]?$/i,

  // Pure numbers + MAN suffix: e.g., 2953-MAN, 2953MAN
  /^\d+\s*MAN$/i,

  // Two letter MN suffix: [A-Z][A-Z]MN followed by numbers
  // Covers: AMN, BMN, CMN, DMN, EMN, FMN, GMN, HMN, JMN, KMN, LMN, MMN, NMN, PMN, RMN, SMN, TMN, VMN, WMN, XMN, YMN
  /^[A-Z]{1,2}MN\s*\d+\s*[A-Z]?$/i,
];

/**
 * Check if a registration number is an Isle of Man plate
 */
export function isManxPlate(registration: string): boolean {
  const normalized = registration.toUpperCase().replace(/[\s-]+/g, ' ').trim();

  for (const pattern of IOM_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(normalized.replace(/\s/g, ''))) {
      return true;
    }
  }

  return false;
}

/**
 * Format an IoM registration for the gov.im API
 * The API expects format like "PMN-147-E" with hyphens
 */
export function formatManxPlateForApi(registration: string): string {
  // Remove all spaces and existing hyphens, uppercase
  const clean = registration.toUpperCase().replace(/[\s-]+/g, '');

  // Try to parse and reformat
  // Pattern: pure digits + MAN (e.g., 2953MAN -> 2953-MAN)
  const numOnlyManMatch = clean.match(/^(\d+)(MAN)$/);
  if (numOnlyManMatch) {
    return `${numOnlyManMatch[1]}-${numOnlyManMatch[2]}`;
  }

  // Pattern: letter + numbers + MAN (e.g., C2MAN)
  const manSuffixMatch = clean.match(/^([A-Z]\d+)(MAN)$/);
  if (manSuffixMatch) {
    return `${manSuffixMatch[1]}-${manSuffixMatch[2]}`;
  }

  // Pattern: letters, numbers, optional letter
  const match = clean.match(/^([A-Z]+)(\d+)([A-Z]?)$/);

  if (match) {
    const [, letters, numbers, suffix] = match;
    if (suffix) {
      return `${letters}-${numbers}-${suffix}`;
    }
    return `${letters}-${numbers}`;
  }

  // For modern format like 1MN00
  const modernMatch = clean.match(/^(\d+)MN(\d+)$/i);
  if (modernMatch) {
    return `${modernMatch[1]}-MN-${modernMatch[2]}`;
  }

  // For numbers + MN suffix: 79NMN, 123MN, 45BMN
  const numMnMatch = clean.match(/^(\d+)([A-Z]?MN[A-Z]?)$/i);
  if (numMnMatch) {
    return `${numMnMatch[1]}-${numMnMatch[2]}`;
  }

  // Fallback: return as-is with hyphens between groups
  return clean;
}

/**
 * Format a Manx plate for display (with spaces)
 */
export function formatManxPlateForDisplay(registration: string): string {
  const clean = registration.toUpperCase().replace(/[\s-]+/g, '');

  // Pattern: pure digits + MAN (e.g., 2953MAN -> 2953 MAN)
  const numOnlyManMatch = clean.match(/^(\d+)(MAN)$/);
  if (numOnlyManMatch) {
    return `${numOnlyManMatch[1]} ${numOnlyManMatch[2]}`;
  }

  // Pattern: letter + numbers + MAN (e.g., C2MAN -> C2 MAN)
  const manSuffixMatch = clean.match(/^([A-Z]\d+)(MAN)$/);
  if (manSuffixMatch) {
    return `${manSuffixMatch[1]} ${manSuffixMatch[2]}`;
  }

  // Pattern: letters, numbers, optional letter
  const match = clean.match(/^([A-Z]+)(\d+)([A-Z]?)$/);

  if (match) {
    const [, letters, numbers, suffix] = match;
    if (suffix) {
      return `${letters} ${numbers} ${suffix}`;
    }
    return `${letters} ${numbers}`;
  }

  // Pattern: numbers + MN suffix (79NMN -> 79 NMN)
  const numMnMatch = clean.match(/^(\d+)([A-Z]?MN[A-Z]?)$/i);
  if (numMnMatch) {
    return `${numMnMatch[1]} ${numMnMatch[2]}`;
  }

  return registration.toUpperCase();
}
