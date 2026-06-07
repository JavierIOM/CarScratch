import type { VehicleData } from './types';

export type ULEZSource = 'scraped' | 'euro-standard' | 'registration-date';
export type ULEZStatus = { compliant: boolean; source: ULEZSource } | null;

const PETROL_CUTOFF = new Date('2006-01-01');
const DIESEL_CUTOFF = new Date('2015-09-01');

export function computeULEZCompliance(vehicle: VehicleData, scrapedCompliant?: boolean): ULEZStatus {
  if (scrapedCompliant !== undefined) {
    return { compliant: scrapedCompliant, source: 'scraped' };
  }

  const fuel = vehicle.fuelType.toLowerCase();

  if (fuel.includes('electric') || fuel.includes('hydrogen')) {
    return { compliant: true, source: 'euro-standard' };
  }

  if (vehicle.euroStatus) {
    const match = vehicle.euroStatus.toUpperCase().match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      const compliant = fuel.includes('diesel') ? num >= 6 : num >= 4;
      return { compliant, source: 'euro-standard' };
    }
  }

  // Fall back to registration date (TfL's own guidance)
  const regStr = vehicle.monthOfFirstRegistration;
  if (regStr) {
    const regDate = new Date(regStr + '-01');
    if (!isNaN(regDate.getTime())) {
      if (fuel.includes('diesel')) {
        return { compliant: regDate >= DIESEL_CUTOFF, source: 'registration-date' };
      }
      if (fuel.includes('petrol') || fuel.includes('hybrid')) {
        return { compliant: regDate >= PETROL_CUTOFF, source: 'registration-date' };
      }
    }
  }

  return null;
}
