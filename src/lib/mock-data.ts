import type { VehicleData, MOTHistory, MOTTest } from './types';

// Mock DVLA data for various registrations
const mockVehicles: Record<string, VehicleData> = {
  'AB12CDE': {
    registrationNumber: 'AB12 CDE',
    make: 'VOLKSWAGEN',
    model: 'GOLF',
    colour: 'BLUE',
    fuelType: 'PETROL',
    engineCapacity: 1984,
    co2Emissions: 139,
    yearOfManufacture: 2012,
    taxStatus: 'Taxed',
    taxDueDate: '2025-03-01',
    motStatus: 'Valid',
    motExpiryDate: '2025-08-15',
    dateOfLastV5CIssued: '2023-06-20',
    wheelplan: '2 AXLE RIGID BODY',
    monthOfFirstRegistration: '2012-03',
    euroStatus: 'Euro 5',
  },
  'BD19XYZ': {
    registrationNumber: 'BD19 XYZ',
    make: 'BMW',
    model: '3 SERIES',
    colour: 'BLACK',
    fuelType: 'DIESEL',
    engineCapacity: 1995,
    co2Emissions: 112,
    yearOfManufacture: 2019,
    taxStatus: 'Taxed',
    taxDueDate: '2025-07-01',
    motStatus: 'Valid',
    motExpiryDate: '2025-11-22',
    dateOfLastV5CIssued: '2024-01-15',
    wheelplan: '2 AXLE RIGID BODY',
    monthOfFirstRegistration: '2019-06',
    euroStatus: 'Euro 6',
  },
  'YH65ABC': {
    registrationNumber: 'YH65 ABC',
    make: 'FORD',
    model: 'FOCUS',
    colour: 'SILVER',
    fuelType: 'PETROL',
    engineCapacity: 1596,
    co2Emissions: 129,
    yearOfManufacture: 2015,
    taxStatus: 'SORN',
    motStatus: 'Not valid',
    motExpiryDate: '2024-02-10',
    dateOfLastV5CIssued: '2022-11-30',
    wheelplan: '2 AXLE RIGID BODY',
    monthOfFirstRegistration: '2015-09',
    euroStatus: 'Euro 6',
  },
  'WR71DEF': {
    registrationNumber: 'WR71 DEF',
    make: 'TESLA',
    model: 'MODEL 3',
    colour: 'WHITE',
    fuelType: 'ELECTRIC',
    engineCapacity: 0,
    co2Emissions: 0,
    yearOfManufacture: 2021,
    taxStatus: 'Taxed',
    taxDueDate: '2025-12-01',
    motStatus: 'Valid',
    motExpiryDate: '2025-09-05',
    dateOfLastV5CIssued: '2024-06-10',
    wheelplan: '2 AXLE RIGID BODY',
    monthOfFirstRegistration: '2021-09',
  },
  'MK08GHI': {
    registrationNumber: 'MK08 GHI',
    make: 'VAUXHALL',
    model: 'ASTRA',
    colour: 'RED',
    fuelType: 'PETROL',
    engineCapacity: 1796,
    co2Emissions: 169,
    yearOfManufacture: 2008,
    taxStatus: 'Untaxed',
    motStatus: 'Not valid',
    motExpiryDate: '2023-05-18',
    dateOfLastV5CIssued: '2021-03-22',
    wheelplan: '2 AXLE RIGID BODY',
    monthOfFirstRegistration: '2008-03',
    euroStatus: 'Euro 4',
  },
};

// Mock MOT history data
const mockMOTHistory: Record<string, MOTHistory> = {
  'AB12CDE': {
    registration: 'AB12CDE',
    make: 'VOLKSWAGEN',
    model: 'GOLF',
    firstUsedDate: '2012-03-15',
    fuelType: 'Petrol',
    primaryColour: 'Blue',
    motTests: [
      {
        completedDate: '2024-08-15',
        testResult: 'PASSED',
        expiryDate: '2025-08-15',
        odometerValue: 87234,
        odometerUnit: 'mi',
        motTestNumber: '1234567890',
        rfrAndComments: [
          { text: 'Front brake disc worn, close to legal limit', type: 'ADVISORY' },
          { text: 'Nearside front tyre worn close to legal limit', type: 'ADVISORY' },
        ],
      },
      {
        completedDate: '2023-08-10',
        testResult: 'PASSED',
        expiryDate: '2024-08-10',
        odometerValue: 78456,
        odometerUnit: 'mi',
        motTestNumber: '1234567889',
        rfrAndComments: [
          { text: 'Nearside front anti-roll bar linkage ball joint has slight play', type: 'ADVISORY' },
        ],
      },
      {
        completedDate: '2022-08-05',
        testResult: 'FAILED',
        odometerValue: 69123,
        odometerUnit: 'mi',
        motTestNumber: '1234567888',
        rfrAndComments: [
          { text: 'Offside headlamp aim too high', type: 'FAIL' },
          { text: 'Nearside front brake disc excessively worn', type: 'MAJOR' },
          { text: 'Exhaust emissions Lambda reading after 2nd fast idle outside specified limits', type: 'FAIL' },
        ],
      },
      {
        completedDate: '2022-08-08',
        testResult: 'PASSED',
        expiryDate: '2023-08-08',
        odometerValue: 69125,
        odometerUnit: 'mi',
        motTestNumber: '1234567887',
        rfrAndComments: [],
      },
      {
        completedDate: '2021-08-02',
        testResult: 'PASSED',
        expiryDate: '2022-08-02',
        odometerValue: 58901,
        odometerUnit: 'mi',
        motTestNumber: '1234567886',
        rfrAndComments: [
          { text: 'Offside front tyre slightly damaged/cracking or perishing', type: 'ADVISORY' },
        ],
      },
      {
        completedDate: '2020-07-28',
        testResult: 'PASSED',
        expiryDate: '2021-07-28',
        odometerValue: 47823,
        odometerUnit: 'mi',
        motTestNumber: '1234567885',
        rfrAndComments: [],
      },
    ],
  },
  'BD19XYZ': {
    registration: 'BD19XYZ',
    make: 'BMW',
    model: '3 SERIES',
    firstUsedDate: '2019-06-20',
    fuelType: 'Diesel',
    primaryColour: 'Black',
    motTests: [
      {
        completedDate: '2024-11-22',
        testResult: 'PASSED',
        expiryDate: '2025-11-22',
        odometerValue: 45234,
        odometerUnit: 'mi',
        motTestNumber: '2345678901',
        rfrAndComments: [],
      },
      {
        completedDate: '2023-11-18',
        testResult: 'PASSED',
        expiryDate: '2024-11-18',
        odometerValue: 32456,
        odometerUnit: 'mi',
        motTestNumber: '2345678900',
        rfrAndComments: [
          { text: 'Windscreen has damage to an area less than a 10mm circle outside zone A', type: 'ADVISORY' },
        ],
      },
      {
        completedDate: '2022-11-15',
        testResult: 'PASSED',
        expiryDate: '2023-11-15',
        odometerValue: 21098,
        odometerUnit: 'mi',
        motTestNumber: '2345678899',
        rfrAndComments: [],
      },
    ],
  },
  'YH65ABC': {
    registration: 'YH65ABC',
    make: 'FORD',
    model: 'FOCUS',
    firstUsedDate: '2015-09-01',
    fuelType: 'Petrol',
    primaryColour: 'Silver',
    motTests: [
      {
        completedDate: '2023-02-10',
        testResult: 'FAILED',
        odometerValue: 112456,
        odometerUnit: 'mi',
        motTestNumber: '3456789012',
        rfrAndComments: [
          { text: 'Offside front outer constant velocity joint gaiter damaged to the extent that it no longer prevents the ingress of dirt', type: 'MAJOR' },
          { text: 'Nearside rear tyre tread depth below requirements', type: 'MAJOR' },
          { text: 'Offside rear tyre tread depth below requirements', type: 'MAJOR' },
          { text: 'Exhaust has a major leak of exhaust gases', type: 'MAJOR' },
        ],
      },
      {
        completedDate: '2022-02-05',
        testResult: 'PASSED',
        expiryDate: '2023-02-05',
        odometerValue: 98234,
        odometerUnit: 'mi',
        motTestNumber: '3456789011',
        rfrAndComments: [
          { text: 'Front brake disc worn, close to legal limit', type: 'ADVISORY' },
          { text: 'Rear brake disc worn, pitting/scoring', type: 'ADVISORY' },
        ],
      },
    ],
  },
  'WR71DEF': {
    registration: 'WR71DEF',
    make: 'TESLA',
    model: 'MODEL 3',
    firstUsedDate: '2021-09-15',
    fuelType: 'Electric',
    primaryColour: 'White',
    motTests: [
      {
        completedDate: '2024-09-05',
        testResult: 'PASSED',
        expiryDate: '2025-09-05',
        odometerValue: 28456,
        odometerUnit: 'mi',
        motTestNumber: '4567890123',
        rfrAndComments: [],
      },
    ],
  },
  'MK08GHI': {
    registration: 'MK08GHI',
    make: 'VAUXHALL',
    model: 'ASTRA',
    firstUsedDate: '2008-03-20',
    fuelType: 'Petrol',
    primaryColour: 'Red',
    motTests: [
      {
        completedDate: '2022-05-18',
        testResult: 'FAILED',
        odometerValue: 156789,
        odometerUnit: 'mi',
        motTestNumber: '5678901234',
        rfrAndComments: [
          { text: 'Nearside rear coil spring fractured', type: 'DANGEROUS', dangerous: true },
          { text: 'Offside front wheel bearing has excessive play', type: 'MAJOR' },
          { text: 'Exhaust emissions exceed the limits', type: 'MAJOR' },
          { text: 'Nearside front brake disc excessively worn', type: 'MAJOR' },
          { text: 'Offside front brake disc excessively worn', type: 'MAJOR' },
          { text: 'Central locking does not secure the vehicle', type: 'MINOR' },
        ],
      },
      {
        completedDate: '2021-05-12',
        testResult: 'PASSED',
        expiryDate: '2022-05-12',
        odometerValue: 145234,
        odometerUnit: 'mi',
        motTestNumber: '5678901233',
        rfrAndComments: [
          { text: 'Nearside front tyre worn close to legal limit', type: 'ADVISORY' },
          { text: 'Offside front tyre worn close to legal limit', type: 'ADVISORY' },
          { text: 'Brake fluid is below minimum', type: 'ADVISORY' },
          { text: 'Exhaust has slight blowing at a joint', type: 'ADVISORY' },
        ],
      },
    ],
  },
};

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getMockVehicleData(registration: string): Promise<VehicleData | null> {
  await delay(300 + Math.random() * 400); // 300-700ms delay

  const normalized = registration.toUpperCase().replace(/\s/g, '');
  return mockVehicles[normalized] || null;
}

export async function getMockMOTHistory(registration: string): Promise<MOTHistory | null> {
  await delay(400 + Math.random() * 500); // 400-900ms delay

  const normalized = registration.toUpperCase().replace(/\s/g, '');
  return mockMOTHistory[normalized] || null;
}
