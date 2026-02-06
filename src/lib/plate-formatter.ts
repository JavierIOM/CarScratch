/**
 * Format a UK registration plate for display with proper spacing.
 *
 * UK plate formats:
 * - Current (2001+): AB12 CDE (4+3)
 * - Prefix (1983-2001): A123 BCD (4+3) or A12 BCD (3+3)
 * - Suffix (1963-1983): ABC 123D (3+4) or AB 12C (2+3)
 * - Dateless: ABC 123, 123 ABC, A 1, 1 A, etc.
 */
export function formatUKPlate(registration: string): string {
  const clean = registration.replace(/\s/g, '').toUpperCase();

  // Current format: 2 letters + 2 numbers + 3 letters (AB12CDE)
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(clean)) {
    return clean.slice(0, 4) + ' ' + clean.slice(4);
  }

  // Prefix format: 1 letter + 2-3 numbers + 3 letters (A123BCD or A12BCD)
  const prefixMatch = clean.match(/^([A-Z])(\d{2,3})([A-Z]{3})$/);
  if (prefixMatch) {
    return prefixMatch[1] + prefixMatch[2] + ' ' + prefixMatch[3];
  }

  // Suffix format: 3 letters + 2-3 numbers + 1 letter (ABC123D or ABC12D)
  const suffixMatch = clean.match(/^([A-Z]{3})(\d{2,3})([A-Z])$/);
  if (suffixMatch) {
    return suffixMatch[1] + ' ' + suffixMatch[2] + suffixMatch[3];
  }

  // Dateless: letters then numbers (ABC123, AB12, A1)
  const datelessLettersFirst = clean.match(/^([A-Z]{1,3})(\d{1,4})$/);
  if (datelessLettersFirst) {
    return datelessLettersFirst[1] + ' ' + datelessLettersFirst[2];
  }

  // Dateless: numbers then letters (123ABC, 12AB, 1A)
  const datelessNumbersFirst = clean.match(/^(\d{1,4})([A-Z]{1,3})$/);
  if (datelessNumbersFirst) {
    return datelessNumbersFirst[1] + ' ' + datelessNumbersFirst[2];
  }

  // Fallback: if longer than 4 chars, split at 4
  if (clean.length > 4) {
    return clean.slice(0, 4) + ' ' + clean.slice(4);
  }

  return clean;
}
