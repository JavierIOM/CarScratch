// Vehicle data from DVLA API
export interface VehicleData {
  registrationNumber: string;
  make: string;
  model?: string;
  colour: string;
  fuelType: string;
  engineCapacity: number;
  co2Emissions?: number;
  yearOfManufacture: number;
  taxStatus: 'Taxed' | 'SORN' | 'Untaxed' | 'Not Taxed for on Road Use';
  taxDueDate?: string;
  motStatus: 'Valid' | 'No details held by DVLA' | 'Not valid';
  motExpiryDate?: string;
  dateOfLastV5CIssued?: string;
  wheelplan?: string;
  monthOfFirstRegistration?: string;
  euroStatus?: string;
  markedForExport?: boolean;
}

// MOT test result
export interface MOTTest {
  completedDate: string;
  testResult: 'PASSED' | 'FAILED';
  expiryDate?: string;
  odometerValue: number;
  odometerUnit: 'mi' | 'km';
  motTestNumber: string;
  rfrAndComments: MOTDefect[];
}

export interface MOTDefect {
  text: string;
  type: 'ADVISORY' | 'MINOR' | 'DANGEROUS' | 'MAJOR' | 'FAIL' | 'PRS';
  dangerous?: boolean;
}

// MOT history from DVSA API
export interface MOTHistory {
  registration: string;
  make: string;
  model: string;
  firstUsedDate?: string;
  fuelType?: string;
  primaryColour?: string;
  motTests: MOTTest[];
}

// Combined vehicle info from all sources
export interface VehicleInfo {
  registration: string;
  vehicle?: VehicleData;
  motHistory?: MOTHistory;
  error?: string;
}
