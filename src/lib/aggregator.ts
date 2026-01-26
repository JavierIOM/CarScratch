import type { VehicleInfo } from './types';
import { getMockVehicleData, getMockMOTHistory } from './mock-data';

// Set to true to use real APIs (when keys are available)
const USE_REAL_APIS = false;

export async function getVehicleInfo(registration: string): Promise<VehicleInfo> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  if (!normalized || normalized.length < 2) {
    return {
      registration: normalized,
      error: 'Invalid registration number',
    };
  }

  try {
    if (USE_REAL_APIS) {
      // TODO: Implement real API calls when keys are available
      // const vehicle = await getDVLAData(normalized);
      // const motHistory = await getMOTHistory(normalized);
    }

    // Use mock data for now
    const [vehicle, motHistory] = await Promise.all([
      getMockVehicleData(normalized),
      getMockMOTHistory(normalized),
    ]);

    if (!vehicle && !motHistory) {
      return {
        registration: normalized,
        error: 'Vehicle not found. Please check the registration number and try again.',
      };
    }

    return {
      registration: normalized,
      vehicle: vehicle || undefined,
      motHistory: motHistory || undefined,
    };
  } catch (err) {
    console.error('Error fetching vehicle info:', err);
    return {
      registration: normalized,
      error: 'An error occurred while fetching vehicle data. Please try again.',
    };
  }
}
