import type { VehicleData } from './types';

export type ULEZStatus = { compliant: true | false; source: 'scraped' | 'euro-standard' } | null;

export function computeULEZCompliance(vehicle: VehicleData, scrapedCompliant?: boolean): ULEZStatus {
  if (scrapedCompliant !== undefined) {
    return { compliant: scrapedCompliant, source: 'scraped' };
  }

  const fuel = vehicle.fuelType.toLowerCase();

  if (fuel.includes('electric') || fuel.includes('hydrogen')) {
    return { compliant: true, source: 'euro-standard' };
  }

  if (!vehicle.euroStatus) return null;

  const match = vehicle.euroStatus.toUpperCase().match(/(\d+)/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const isCompliant = fuel.includes('diesel') ? num >= 6 : num >= 4;

  return { compliant: isCompliant, source: 'euro-standard' };
}
