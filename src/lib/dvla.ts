import type { VehicleData } from './types';

/**
 * DVLA Vehicle Enquiry Service API client
 * https://developer-portal.driver-vehicle-licensing.api.gov.uk/
 */

// DVLA API response interface
interface DVLAResponse {
  registrationNumber: string;
  taxStatus: string;
  taxDueDate?: string;
  motStatus: string;
  motExpiryDate?: string;
  make: string;
  monthOfFirstDvlaRegistration?: string;
  monthOfFirstRegistration?: string;
  yearOfManufacture: number;
  engineCapacity?: number;
  co2Emissions?: number;
  fuelType: string;
  markedForExport: boolean;
  colour: string;
  typeApproval?: string;
  wheelplan?: string;
  revenueWeight?: number;
  realDrivingEmissions?: string;
  dateOfLastV5CIssued?: string;
  euroStatus?: string;
}

// Cache for DVLA lookups
const dvlaCache = new Map<string, { data: VehicleData | null; timestamp: number }>();
const DVLA_CACHE_TTL = 1000 * 60 * 60; // 1 hour cache (data changes infrequently)

/**
 * Fetch vehicle data from DVLA Vehicle Enquiry Service
 */
export async function getDVLAVehicle(registration: string): Promise<VehicleData | null> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  // Check cache
  const cached = dvlaCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < DVLA_CACHE_TTL) {
    return cached.data;
  }

  const apiKey = import.meta.env.DVLA_API_KEY;

  if (!apiKey) {
    console.warn('DVLA_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(
      'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationNumber: normalized,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Vehicle not found
        dvlaCache.set(normalized, { data: null, timestamp: Date.now() });
        return null;
      }
      console.error(`DVLA API error: ${response.status}`);
      return null;
    }

    const data: DVLAResponse = await response.json();

    // Convert DVLA response to our VehicleData format
    const vehicleData: VehicleData = {
      registrationNumber: data.registrationNumber,
      make: data.make,
      colour: data.colour,
      fuelType: data.fuelType,
      engineCapacity: data.engineCapacity || 0,
      co2Emissions: data.co2Emissions,
      yearOfManufacture: data.yearOfManufacture,
      taxStatus: mapTaxStatus(data.taxStatus),
      taxDueDate: data.taxDueDate,
      motStatus: mapMOTStatus(data.motStatus),
      motExpiryDate: data.motExpiryDate,
      dateOfLastV5CIssued: data.dateOfLastV5CIssued,
      wheelplan: data.wheelplan,
      monthOfFirstRegistration: data.monthOfFirstRegistration || data.monthOfFirstDvlaRegistration,
      euroStatus: data.euroStatus,
      markedForExport: data.markedForExport,
    };

    // Cache the result
    dvlaCache.set(normalized, { data: vehicleData, timestamp: Date.now() });

    return vehicleData;
  } catch (error) {
    console.error('Error fetching DVLA data:', error);
    return null;
  }
}

/**
 * Map DVLA tax status to our enum
 */
function mapTaxStatus(status: string): VehicleData['taxStatus'] {
  const lower = status.toLowerCase();
  if (lower === 'taxed') return 'Taxed';
  if (lower === 'sorn') return 'SORN';
  if (lower.includes('not taxed for on road use')) return 'Not Taxed for on Road Use';
  return 'Untaxed';
}

/**
 * Map DVLA MOT status to our enum
 */
function mapMOTStatus(status: string): VehicleData['motStatus'] {
  const lower = status.toLowerCase();
  if (lower === 'valid') return 'Valid';
  if (lower.includes('no details')) return 'No details held by DVLA';
  return 'Not valid';
}
