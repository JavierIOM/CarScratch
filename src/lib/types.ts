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

// Scraped extra data from third-party sites
export interface ScrapedExtras {
  // Performance
  bhp?: number;
  topSpeed?: string;
  zeroToSixty?: string;

  // Insurance & compliance
  insuranceGroup?: string;
  ulezCompliant?: boolean;
  cazCompliant?: boolean;

  // Market data
  previousPrice?: string;
  previousMileage?: string;

  // Additional details
  bodyStyle?: string;
  registrationLocation?: string;

  // Isle of Man specific
  previousUKRegistration?: string;
  dateOfFirstRegistrationIOM?: string;
  modelVariant?: string;
  category?: string;

  // Source tracking
  sources?: string[];
}

// Insurance check result
export interface InsuranceStatus {
  insured: boolean | null;
  message?: string;
  checkedAt: string;
}

// Combined vehicle info from all sources
export interface VehicleInfo {
  registration: string;
  vehicle?: VehicleData;
  motHistory?: MOTHistory;
  extras?: ScrapedExtras;
  insurance?: InsuranceStatus;
  ukVehicle?: VehicleData;
  isManx?: boolean;
  error?: string;
}
