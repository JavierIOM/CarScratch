/**
 * Isle of Man Vehicle Duty calculator
 * Based on Vehicle Duty Order 2023 (SD 2023/0063)
 * https://www.legislation.gov.im/cms/images/LEGISLATION/SUBORDINATE/2023/2023-0063/2023-0063.pdf
 */

interface DutyBand {
  band: string;
  minCO2: number;
  maxCO2: number; // Infinity for the top band
  duty12Month: number;
  duty6Month: number;
}

interface EngineCapacityBand {
  minCC: number;
  maxCC: number; // Infinity for the top band
  duty12Month: number;
  duty6Month: number;
}

// Article 4, paragraph (1) - CO2 emission bands
const IOM_CO2_BANDS: DutyBand[] = [
  { band: 'ZEV', minCO2: 0, maxCO2: 0, duty12Month: 65, duty6Month: 39 },
  { band: 'A', minCO2: 1, maxCO2: 50, duty12Month: 65, duty6Month: 39 },
  { band: 'B', minCO2: 51, maxCO2: 75, duty12Month: 65, duty6Month: 39 },
  { band: 'C', minCO2: 76, maxCO2: 100, duty12Month: 65, duty6Month: 39 },
  { band: 'D', minCO2: 101, maxCO2: 110, duty12Month: 65, duty6Month: 39 },
  { band: 'E', minCO2: 111, maxCO2: 120, duty12Month: 79, duty6Month: 46 },
  { band: 'F', minCO2: 121, maxCO2: 130, duty12Month: 169, duty6Month: 91 },
  { band: 'G', minCO2: 131, maxCO2: 140, duty12Month: 203, duty6Month: 108 },
  { band: 'H', minCO2: 141, maxCO2: 150, duty12Month: 235, duty6Month: 124 },
  { band: 'I', minCO2: 151, maxCO2: 165, duty12Month: 268, duty6Month: 140 },
  { band: 'J', minCO2: 166, maxCO2: 175, duty12Month: 302, duty6Month: 157 },
  { band: 'K', minCO2: 176, maxCO2: 185, duty12Month: 336, duty6Month: 174 },
  { band: 'L', minCO2: 186, maxCO2: 200, duty12Month: 394, duty6Month: 203 },
  { band: 'M', minCO2: 201, maxCO2: 225, duty12Month: 410, duty6Month: 211 },
  { band: 'N', minCO2: 226, maxCO2: 255, duty12Month: 700, duty6Month: 356 },
  { band: 'O', minCO2: 256, maxCO2: Infinity, duty12Month: 724, duty6Month: 368 },
];

// Schedule 1, paragraph 3 - Category B vehicles by engine capacity
// Fallback for vehicles without CO2 data (e.g. pre-2001 registration)
const IOM_ENGINE_BANDS: EngineCapacityBand[] = [
  { minCC: 0, maxCC: 1000, duty12Month: 65, duty6Month: 39 },
  { minCC: 1001, maxCC: 1200, duty12Month: 130, duty6Month: 71 },
  { minCC: 1201, maxCC: 1800, duty12Month: 203, duty6Month: 108 },
  { minCC: 1801, maxCC: 2500, duty12Month: 288, duty6Month: 150 },
  { minCC: 2501, maxCC: 3500, duty12Month: 467, duty6Month: 240 },
  { minCC: 3501, maxCC: 5000, duty12Month: 576, duty6Month: 294 },
  { minCC: 5001, maxCC: Infinity, duty12Month: 612, duty6Month: 312 },
];

// Schedule 1, paragraph 1 - Veteran vehicles (30+ years old)
const VETERAN_DUTY = 28;

// Schedule 1, Part 1, paragraph 1 - Category A, A1 and P (motorcycles): flat £28, no 6-month
const MOTORCYCLE_DUTY = 28;
const MOTORCYCLE_CATEGORIES = new Set(['A', 'A1', 'P']);

export interface IOMDutyResult {
  band: string;
  duty12Month: string;
  duty6Month: string;
}

// The CO2 emission bands (Category A) only apply to vehicles first
// registered on or after 1 April 2010. Older vehicles use the engine
// capacity bands (Category B) instead.
const CO2_CUTOFF_DATE = new Date('2010-04-01');

/**
 * Parse a registration date string into a Date object.
 * Handles formats like "2010-03", "2010-03-15", "15/03/2010", "March 2010" etc.
 */
function parseRegistrationDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // ISO format: "2010-03" or "2010-03-15"
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // UK format: "15/03/2010" or "03/2010"
  const ukMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukMatch) {
    return new Date(parseInt(ukMatch[3]), parseInt(ukMatch[2]) - 1, parseInt(ukMatch[1]));
  }
  const ukShort = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (ukShort) {
    return new Date(parseInt(ukShort[2]), parseInt(ukShort[1]) - 1, 1);
  }

  // Try extracting just a year as last resort
  const yearMatch = trimmed.match(/(\d{4})/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }

  return null;
}

/**
 * Calculate Isle of Man vehicle duty.
 *
 * Priority:
 * 1. Veteran vehicles (30+ years) → flat £28
 * 2. Registered BEFORE 1 April 2010 → engine capacity bands (Category B)
 * 3. Registered ON/AFTER 1 April 2010 → CO2 emission bands (Category A)
 * 4. No date known → CO2 if available, else engine capacity fallback
 */
export function calculateIOMDuty(
  co2Emissions: number | undefined,
  engineCapacityCC?: number,
  yearOfManufacture?: number,
  firstRegistrationDate?: string,
  vehicleCategory?: string
): IOMDutyResult | null {
  // Motorcycles (Category A, A1, P): flat £28, no 6-month licence available
  if (vehicleCategory && MOTORCYCLE_CATEGORIES.has(vehicleCategory.trim().toUpperCase())) {
    return {
      band: 'Motorcycle',
      duty12Month: `£${MOTORCYCLE_DUTY}`,
      duty6Month: 'N/A',
    };
  }

  // Veteran vehicles: 30+ years old, flat rate £28
  if (yearOfManufacture) {
    const vehicleAge = new Date().getFullYear() - yearOfManufacture;
    if (vehicleAge >= 30) {
      return {
        band: 'Veteran',
        duty12Month: `£${VETERAN_DUTY}`,
        duty6Month: 'N/A',
      };
    }
  }

  // Determine if vehicle was registered before the CO2 cutoff
  const regDate = parseRegistrationDate(firstRegistrationDate);
  const isPreApril2010 = regDate ? regDate < CO2_CUTOFF_DATE : false;

  // Pre-April 2010: must use engine capacity bands (Category B)
  if (isPreApril2010 && engineCapacityCC && engineCapacityCC > 0) {
    const band = IOM_ENGINE_BANDS.find(
      (b) => engineCapacityCC >= b.minCC && engineCapacityCC <= b.maxCC
    );
    if (band) {
      return {
        band: `${engineCapacityCC}cc`,
        duty12Month: `£${band.duty12Month}`,
        duty6Month: `£${band.duty6Month}`,
      };
    }
  }

  // Post-April 2010 (or unknown date): use CO2 emissions table
  if (co2Emissions !== undefined && co2Emissions !== null) {
    const band = IOM_CO2_BANDS.find(
      (b) => co2Emissions >= b.minCO2 && co2Emissions <= b.maxCO2
    );
    if (band) {
      return {
        band: band.band,
        duty12Month: `£${band.duty12Month}`,
        duty6Month: `£${band.duty6Month}`,
      };
    }
  }

  // Final fallback: engine capacity table (for vehicles with no CO2 data and no date)
  if (engineCapacityCC && engineCapacityCC > 0) {
    const band = IOM_ENGINE_BANDS.find(
      (b) => engineCapacityCC >= b.minCC && engineCapacityCC <= b.maxCC
    );
    if (band) {
      return {
        band: `${engineCapacityCC}cc`,
        duty12Month: `£${band.duty12Month}`,
        duty6Month: `£${band.duty6Month}`,
      };
    }
  }

  return null;
}
