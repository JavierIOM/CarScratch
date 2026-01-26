import type { VehicleInfo, ScrapedExtras } from './types';
import { getMockVehicleData, getMockMOTHistory } from './mock-data';
import { scrapeTotalCarCheck } from './scraper';

// Set to true to use real APIs (when keys are available)
const USE_REAL_APIS = false;

// Set to true to enable scraping from third-party sites
const ENABLE_SCRAPING = true;

export async function getVehicleInfo(registration: string): Promise<VehicleInfo> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  if (!normalized || normalized.length < 2) {
    return {
      registration: normalized,
      error: 'Invalid registration number',
    };
  }

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

    const vehicle = results[0] as Awaited<ReturnType<typeof getMockVehicleData>>;
    const motHistory = results[1] as Awaited<ReturnType<typeof getMockMOTHistory>>;
    const scrapedData = ENABLE_SCRAPING
      ? (results[2] as Awaited<ReturnType<typeof scrapeTotalCarCheck>>)
      : null;

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
