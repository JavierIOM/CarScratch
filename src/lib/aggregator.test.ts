import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MOTHistory, VehicleData } from './types';

/**
 * These tests cover only the MOT failure-vs-absence handling in aggregator.ts,
 * which is the part changed alongside mot.ts. They do not touch, and do not
 * need to touch, how DVLA, the IoM scraper or CheckCarDetails are requested.
 */

const mocks = vi.hoisted(() => ({
  getMOTHistory: vi.fn(),
  getDVLAVehicle: vi.fn(),
  scrapeTotalCarCheck: vi.fn(),
  checkChrystalsAuction: vi.fn(),
}));

vi.mock('./mot', () => ({ getMOTHistory: mocks.getMOTHistory }));
vi.mock('./dvla', () => ({ getDVLAVehicle: mocks.getDVLAVehicle }));
vi.mock('./scraper', () => ({ scrapeTotalCarCheck: mocks.scrapeTotalCarCheck }));
vi.mock('./chrystals', () => ({ checkChrystalsAuction: mocks.checkChrystalsAuction }));

const TEST_REG = 'AB12CDE'; // ordinary UK-format reg, not a Manx plate

const sampleVehicle: VehicleData = {
  registrationNumber: TEST_REG,
  make: 'Ford',
  colour: 'Blue',
  fuelType: 'Petrol',
  engineCapacity: 1600,
  yearOfManufacture: 2018,
  taxStatus: 'Taxed',
  motStatus: 'Valid',
};

const sampleMOTHistory: MOTHistory = {
  registration: TEST_REG,
  make: 'Ford',
  model: 'Focus',
  motTests: [
    {
      completedDate: '2024-01-01',
      testResult: 'PASSED',
      odometerValue: 50000,
      odometerUnit: 'mi',
      motTestNumber: '1',
      rfrAndComments: [],
    },
  ],
};

describe('getVehicleInfo: MOT failure vs genuine absence', () => {
  beforeEach(() => {
    vi.resetModules();
    // USE_MOT_API and USE_DVLA_API are computed once at module load from these,
    // so they must be set before aggregator.ts is (re-)imported below.
    vi.stubEnv('MOT_CLIENT_ID', 'test-id');
    vi.stubEnv('MOT_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('MOT_API_KEY', 'test-key');
    vi.stubEnv('DVLA_API_KEY', 'test-dvla-key');

    mocks.getMOTHistory.mockReset();
    mocks.getDVLAVehicle.mockReset();
    mocks.scrapeTotalCarCheck.mockReset();
    mocks.checkChrystalsAuction.mockReset();

    mocks.scrapeTotalCarCheck.mockResolvedValue(null);
    mocks.checkChrystalsAuction.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports a distinct lookup_failed error when MOT fails and nothing else is found', async () => {
    mocks.getMOTHistory.mockResolvedValue({ status: 'failed' });
    mocks.getDVLAVehicle.mockResolvedValue(null);

    const { getVehicleInfo } = await import('./aggregator');
    const result = await getVehicleInfo(TEST_REG);

    expect(result.error).toBeTruthy();
    expect(result.errorKind).toBe('lookup_failed');
  });

  it('never labels a failed MOT lookup as a genuinely unrecognised registration', async () => {
    mocks.getMOTHistory.mockResolvedValue({ status: 'failed' });
    mocks.getDVLAVehicle.mockResolvedValue(null);

    const { getVehicleInfo } = await import('./aggregator');
    const result = await getVehicleInfo(TEST_REG);

    // The pre-existing message text for a genuine miss. A failed check must
    // never produce this, since it implies something false about the vehicle.
    expect(result.error).not.toMatch(/vehicle not found/i);
    expect(result.errorKind).not.toBe('not_found');
  });

  it('surfaces motHistoryUnavailable rather than a top-level error when other data is found', async () => {
    mocks.getMOTHistory.mockResolvedValue({ status: 'failed' });
    mocks.getDVLAVehicle.mockResolvedValue(sampleVehicle);

    const { getVehicleInfo } = await import('./aggregator');
    const result = await getVehicleInfo(TEST_REG);

    expect(result.error).toBeUndefined();
    expect(result.vehicle).toBeTruthy();
    expect(result.motHistoryUnavailable).toBe(true);
    expect(result.motHistory).toBeUndefined();
  });

  it('treats a confirmed not_found MOT result as genuine absence, not a failure', async () => {
    mocks.getMOTHistory.mockResolvedValue({ status: 'not_found' });
    mocks.getDVLAVehicle.mockResolvedValue(sampleVehicle);

    const { getVehicleInfo } = await import('./aggregator');
    const result = await getVehicleInfo(TEST_REG);

    expect(result.motHistoryUnavailable).toBeFalsy();
    expect(result.motHistory).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('populates motHistory normally on a successful lookup', async () => {
    mocks.getMOTHistory.mockResolvedValue({ status: 'found', data: sampleMOTHistory });
    mocks.getDVLAVehicle.mockResolvedValue(null);

    const { getVehicleInfo } = await import('./aggregator');
    const result = await getVehicleInfo(TEST_REG);

    expect(result.motHistory).toEqual(sampleMOTHistory);
    expect(result.motHistoryUnavailable).toBeFalsy();
  });
});
