/**
 * Isle of Man Vehicle Duty calculator
 * Based on Road Vehicles (Registration and Licensing) (Amendment) Order 2023
 * https://www.legislation.gov.im/cms/images/LEGISLATION/SUBORDINATE/2023/2023-0063/2023-0063.pdf
 */

interface DutyBand {
  band: string;
  minCO2: number;
  maxCO2: number; // Infinity for the top band
  duty12Month: number;
  duty6Month: number;
}

const IOM_DUTY_BANDS: DutyBand[] = [
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

export interface IOMDutyResult {
  band: string;
  duty12Month: string;
  duty6Month: string;
}

/**
 * Calculate Isle of Man vehicle duty from CO2 emissions
 * Returns null if CO2 value is not available
 */
export function calculateIOMDuty(co2Emissions: number | undefined): IOMDutyResult | null {
  if (co2Emissions === undefined || co2Emissions === null) return null;

  const band = IOM_DUTY_BANDS.find(
    (b) => co2Emissions >= b.minCO2 && co2Emissions <= b.maxCO2
  );

  if (!band) return null;

  return {
    band: band.band,
    duty12Month: `£${band.duty12Month}`,
    duty6Month: `£${band.duty6Month}`,
  };
}
