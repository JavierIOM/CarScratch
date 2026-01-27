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

  // MANX prefix: MANX followed by numbers and optional letter suffix
  // e.g., MANX 1, MANX 2, MANX 100 A
  /^MANX\s*\d+\s*[A-Z]?$/i,

  // Modern format: number-MN-number
  // e.g., 1-MN-00, 123-MN-456
  /^\d+-MN-\d+$/i,

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

  // Fallback: return as-is with hyphens between groups
  return clean;
}

/**
 * Format a Manx plate for display (with spaces)
 */
export function formatManxPlateForDisplay(registration: string): string {
  const clean = registration.toUpperCase().replace(/[\s-]+/g, '');

  // Pattern: letters, numbers, optional letter
  const match = clean.match(/^([A-Z]+)(\d+)([A-Z]?)$/);

  if (match) {
    const [, letters, numbers, suffix] = match;
    if (suffix) {
      return `${letters} ${numbers} ${suffix}`;
    }
    return `${letters} ${numbers}`;
  }

  return registration.toUpperCase();
}
