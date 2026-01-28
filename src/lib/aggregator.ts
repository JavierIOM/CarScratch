import type { VehicleInfo, VehicleData, ScrapedExtras } from './types';
import { getMockVehicleData, getMockMOTHistory } from './mock-data';
import { scrapeTotalCarCheck } from './scraper';
import { isManxPlate } from './iom-detector';
import { scrapeIOMVehicle, iomToVehicleData } from './iom-scraper';
import { getDVLAVehicle } from './dvla';

// Check if DVLA API key is available
const DVLA_API_KEY = import.meta.env.DVLA_API_KEY;
const USE_DVLA_API = !!DVLA_API_KEY;

/**
 * Validate and sanitize scraped string values
 * Returns undefined if the value looks like garbage/HTML/invalid
 */
function sanitizeScrapedString(value: string | undefined, maxLength = 100): string | undefined {
  if (!value) return undefined;

  // Trim whitespace
  const trimmed = value.trim();

  // Reject empty strings
  if (!trimmed) return undefined;

  // Reject if it contains HTML tags or fragments
  if (/<[^>]*>/.test(trimmed) || /[<>"]/.test(trimmed)) return undefined;

  // Reject if it's too long (probably scraped garbage)
  if (trimmed.length > maxLength) return undefined;

  // Reject common garbage patterns
  const garbagePatterns = [
    /^n\/?a$/i,           // N/A, N\A
    /^-$/,                 // Just a dash
    /^unknown$/i,          // Unknown
    /^not available$/i,    // Not available
    /company offers/i,     // Common scraping garbage
    /settlement figure/i,
    /click here/i,
    /learn more/i,
    /^\s*$/,               // Whitespace only
  ];

  if (garbagePatterns.some(pattern => pattern.test(trimmed))) return undefined;

  return trimmed;
}

/**
 * Validate insurance group - should be a number or number + letter (e.g., "15", "32E")
 */
function sanitizeInsuranceGroup(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  // Insurance groups are typically 1-50 with optional letter suffix
  const match = trimmed.match(/^(\d{1,2}[A-Z]?)$/i);
  if (match) return match[1].toUpperCase();

  // Try to extract just the number
  const numMatch = trimmed.match(/\b(\d{1,2})\b/);
  if (numMatch && parseInt(numMatch[1]) <= 50) return numMatch[1];

  return undefined;
}

/**
 * Validate price - should look like a price (£X,XXX or similar)
 */
function sanitizePrice(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  // Should contain currency symbol or numbers that look like prices
  if (/[£$€]?\s*[\d,]+/.test(trimmed) && !/</.test(trimmed)) {
    // Clean up and return
    const cleaned = trimmed.replace(/[<>]/g, '');
    if (cleaned.length <= 20) return cleaned;
  }

  return undefined;
}

/**
 * Validate UK registration - should match UK plate patterns
 */
function sanitizeUKRegistration(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase().replace(/\s/g, '');

  // Reject N/A values
  if (/^N\/?A$/i.test(trimmed)) return undefined;

  // Basic UK plate patterns (not exhaustive, but catches obvious garbage)
  const ukPatterns = [
    /^[A-Z]{2}\d{2}[A-Z]{3}$/,     // Current format: AB12CDE
    /^[A-Z]\d{1,3}[A-Z]{3}$/,       // Prefix format: A123BCD
    /^[A-Z]{3}\d{1,3}[A-Z]$/,       // Suffix format: ABC123D
    /^[A-Z]{1,3}\d{1,4}$/,          // Dateless: ABC1234
    /^\d{1,4}[A-Z]{1,3}$/,          // Dateless: 1234ABC
  ];

  if (ukPatterns.some(pattern => pattern.test(trimmed))) {
    // Format nicely
    if (trimmed.length > 4) {
      return trimmed.slice(0, 4) + ' ' + trimmed.slice(4);
    }
    return trimmed;
  }

  return undefined;
}

// Set to true to enable scraping from third-party sites
const ENABLE_SCRAPING = true;

// Set to true to enable Isle of Man lookups via Browserless
const ENABLE_IOM_LOOKUP = true;

export async function getVehicleInfo(registration: string): Promise<VehicleInfo> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  if (!normalized || normalized.length < 2) {
    return {
      registration: normalized,
      error: 'Invalid registration number',
    };
  }

  // Check if this is an Isle of Man registration
  const isManx = isManxPlate(registration);

  if (isManx && ENABLE_IOM_LOOKUP) {
    return getIOMVehicleInfo(normalized, registration);
  }

  // Standard UK lookup
  return getUKVehicleInfo(normalized);
}

/**
 * Get vehicle info for Isle of Man registrations
 */
async function getIOMVehicleInfo(
  normalized: string,
  originalReg: string
): Promise<VehicleInfo> {
  try {
    const iomData = await scrapeIOMVehicle(originalReg);

    if (!iomData) {
      return {
        registration: normalized,
        isManx: true,
        error:
          'Isle of Man lookup failed. The gov.im service may be unavailable. ' +
          'Please try again later.',
      };
    }

    if (!iomData.make) {
      // Include debug info in error if available
      const debugInfo = iomData._debug;
      let errorMsg = 'Could not extract vehicle data from gov.im.';
      if (debugInfo?.error) {
        errorMsg += ' Error: ' + debugInfo.error;
      }
      if (debugInfo?.url) {
        errorMsg += ' URL: ' + debugInfo.url;
      }
      if (debugInfo?.htmlPreview) {
        // Show first 200 chars of HTML for debugging
        errorMsg += ' Page preview: ' + debugInfo.htmlPreview.substring(0, 200);
      }
      return {
        registration: normalized,
        isManx: true,
        error: errorMsg,
      };
    }

    // Convert IoM data to standard vehicle format
    const vehicle = iomToVehicleData(iomData);

    // Build extras with IoM-specific fields (sanitized)
    const extras: ScrapedExtras = {
      previousUKRegistration: sanitizeUKRegistration(iomData.previousUKRegistration),
      dateOfFirstRegistrationIOM: sanitizeScrapedString(iomData.dateOfFirstRegistrationIOM),
      modelVariant: sanitizeScrapedString(iomData.modelVariant),
      category: sanitizeScrapedString(iomData.category, 20),
      sources: ['gov.im'],
    };

    // If there's a previous UK registration, also fetch UK data for MOT history
    let motHistory = undefined;
    let ukExtras: ScrapedExtras | undefined;
    let ukVehicle: VehicleData | undefined;

    if (iomData.previousUKRegistration) {
      const ukInfo = await getUKVehicleInfo(
        iomData.previousUKRegistration.replace(/\s/g, '')
      );
      motHistory = ukInfo.motHistory;
      ukVehicle = ukInfo.vehicle;

      // Merge any UK extras (but keep IoM as primary source)
      if (ukInfo.extras) {
        ukExtras = ukInfo.extras;
      }
    }

    // Merge extras
    const mergedExtras: ScrapedExtras = {
      ...ukExtras,
      ...extras,
      sources: [
        'gov.im',
        ...(ukExtras?.sources || []),
      ],
    };

    return {
      registration: normalized,
      vehicle,
      motHistory,
      extras: mergedExtras,
      ukVehicle,
      isManx: true,
    };
  } catch (err) {
    console.error('Error fetching IoM vehicle info:', err);
    return {
      registration: normalized,
      isManx: true,
      error: 'An error occurred while fetching Isle of Man vehicle data. Please try again.',
    };
  }
}

/**
 * Get vehicle info for standard UK registrations
 */
async function getUKVehicleInfo(normalized: string): Promise<VehicleInfo> {
  try {
    // Start all data fetching in parallel
    const promises: Promise<unknown>[] = [];

    // Use real DVLA API if available, otherwise fall back to mock
    if (USE_DVLA_API) {
      promises.push(getDVLAVehicle(normalized));
    } else {
      promises.push(getMockVehicleData(normalized));
    }

    // MOT history (still using mock for now - TODO: add real MOT API)
    promises.push(getMockMOTHistory(normalized));

    // Scrape additional data if enabled
    if (ENABLE_SCRAPING) {
      promises.push(scrapeTotalCarCheck(normalized));
    }

    const results = await Promise.all(promises);

    let vehicle = results[0] as VehicleData | null;
    const motHistory = results[1] as Awaited<ReturnType<typeof getMockMOTHistory>>;
    const scrapedData = ENABLE_SCRAPING
      ? (results[2] as Awaited<ReturnType<typeof scrapeTotalCarCheck>>)
      : null;

    // If no mock/API vehicle data but we have scraped data, build vehicle from scraped
    if (!vehicle && scrapedData && scrapedData.manufacturer) {
      vehicle = buildVehicleFromScraped(normalized, scrapedData);
    }

    // Build extras from scraped data (sanitized)
    let extras: ScrapedExtras | undefined;
    if (scrapedData) {
      extras = {
        bhp: scrapedData.bhp,
        topSpeed: sanitizeScrapedString(scrapedData.topSpeed, 30),
        zeroToSixty: sanitizeScrapedString(scrapedData.zeroToSixty, 30),
        insuranceGroup: sanitizeInsuranceGroup(scrapedData.insuranceGroup),
        ulezCompliant: scrapedData.ulezCompliant,
        cazCompliant: scrapedData.cazCompliant,
        previousPrice: sanitizePrice(scrapedData.previousPrice),
        previousMileage: sanitizeScrapedString(scrapedData.previousMileage, 30),
        bodyStyle: sanitizeScrapedString(scrapedData.bodyStyle, 50),
        registrationLocation: sanitizeScrapedString(scrapedData.registrationLocation, 50),
        sources: scrapedData.scrapedFrom ? [scrapedData.scrapedFrom] : [],
      };
    }

    // If we have scraped data but no mock data, still return results
    const hasAnyData = vehicle || motHistory || scrapedData;

    if (!hasAnyData) {
      return {
        registration: normalized,
        error: 'Vehicle not found. Please check the registration number and try again.',
      };
    }

    return {
      registration: normalized,
      vehicle: vehicle || undefined,
      motHistory: motHistory || undefined,
      extras,
    };
  } catch (err) {
    console.error('Error fetching vehicle info:', err);
    return {
      registration: normalized,
      error: 'An error occurred while fetching vehicle data. Please try again.',
    };
  }
}

// Build a VehicleData object from scraped data
function buildVehicleFromScraped(
  registration: string,
  scraped: NonNullable<Awaited<ReturnType<typeof scrapeTotalCarCheck>>>
): VehicleData {
  // Parse engine size to cc
  let engineCapacity = 0;
  if (scraped.engineSize) {
    const ccMatch = scraped.engineSize.match(/(\d+)\s*cc/i);
    if (ccMatch) {
      engineCapacity = parseInt(ccMatch[1], 10);
    } else {
      // Try parsing as liters
      const literMatch = scraped.engineSize.match(/([\d.]+)\s*l/i);
      if (literMatch) {
        engineCapacity = Math.round(parseFloat(literMatch[1]) * 1000);
      }
    }
  }

  // Parse tax status
  let taxStatus: VehicleData['taxStatus'] = 'Untaxed';
  if (scraped.taxStatus) {
    const lower = scraped.taxStatus.toLowerCase();
    if (lower.includes('taxed') && !lower.includes('untaxed') && !lower.includes('not taxed')) {
      taxStatus = 'Taxed';
    } else if (lower.includes('sorn')) {
      taxStatus = 'SORN';
    }
  }

  // Parse MOT status
  let motStatus: VehicleData['motStatus'] = 'No details held by DVLA';
  if (scraped.motStatus) {
    const lower = scraped.motStatus.toLowerCase();
    if (lower.includes('valid') || (lower.includes('expires') && !lower.includes('expired'))) {
      motStatus = 'Valid';
    } else if (lower.includes('expired') || lower.includes('not valid')) {
      motStatus = 'Not valid';
    }
  }

  return {
    registrationNumber: registration,
    make: scraped.manufacturer || 'Unknown',
    model: scraped.model,
    colour: scraped.colour || 'Unknown',
    fuelType: scraped.fuelType || 'Unknown',
    engineCapacity,
    yearOfManufacture: scraped.yearOfManufacture || 0,
    taxStatus,
    motStatus,
    euroStatus: scraped.euroStatus,
  };
}
