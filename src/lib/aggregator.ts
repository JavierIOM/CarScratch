import type { VehicleInfo, VehicleData, ScrapedExtras } from './types';
import { getMockVehicleData, getMockMOTHistory } from './mock-data';
import { scrapeTotalCarCheck } from './scraper';
import { isManxPlate } from './iom-detector';
import { scrapeIOMVehicle, iomToVehicleData } from './iom-scraper';

// Set to true to use real APIs (when keys are available)
const USE_REAL_APIS = false;

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

    // Build extras with IoM-specific fields
    const extras: ScrapedExtras = {
      previousUKRegistration: iomData.previousUKRegistration,
      dateOfFirstRegistrationIOM: iomData.dateOfFirstRegistrationIOM,
      modelVariant: iomData.modelVariant,
      category: iomData.category,
      sources: ['gov.im'],
    };

    // If there's a previous UK registration, also fetch UK data for MOT history
    let motHistory = undefined;
    let ukExtras: ScrapedExtras | undefined;

    if (iomData.previousUKRegistration) {
      const ukInfo = await getUKVehicleInfo(
        iomData.previousUKRegistration.replace(/\s/g, '')
      );
      motHistory = ukInfo.motHistory;

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

    // Mock/API data
    if (USE_REAL_APIS) {
      // TODO: Implement real API calls when keys are available
      // promises.push(getDVLAData(normalized));
      // promises.push(getMOTHistory(normalized));
    }

    // Always fetch mock data for now
    promises.push(getMockVehicleData(normalized));
    promises.push(getMockMOTHistory(normalized));

    // Scrape additional data if enabled
    if (ENABLE_SCRAPING) {
      promises.push(scrapeTotalCarCheck(normalized));
    }

    const results = await Promise.all(promises);

    let vehicle = results[0] as Awaited<ReturnType<typeof getMockVehicleData>>;
    const motHistory = results[1] as Awaited<ReturnType<typeof getMockMOTHistory>>;
    const scrapedData = ENABLE_SCRAPING
      ? (results[2] as Awaited<ReturnType<typeof scrapeTotalCarCheck>>)
      : null;

    // If no mock/API vehicle data but we have scraped data, build vehicle from scraped
    if (!vehicle && scrapedData && scrapedData.manufacturer) {
      vehicle = buildVehicleFromScraped(normalized, scrapedData);
    }

    // Build extras from scraped data
    let extras: ScrapedExtras | undefined;
    if (scrapedData) {
      extras = {
        bhp: scrapedData.bhp,
        topSpeed: scrapedData.topSpeed,
        zeroToSixty: scrapedData.zeroToSixty,
        insuranceGroup: scrapedData.insuranceGroup,
        ulezCompliant: scrapedData.ulezCompliant,
        cazCompliant: scrapedData.cazCompliant,
        previousPrice: scrapedData.previousPrice,
        previousMileage: scrapedData.previousMileage,
        bodyStyle: scrapedData.bodyStyle,
        registrationLocation: scrapedData.registrationLocation,
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
