import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Covers the three outcomes getMOTHistory() can return, and confirms they stay
 * distinct: a confirmed 404 ('not_found') must never be produced by the same
 * paths that produce 'failed' (auth, 5xx, network, token exchange).
 */

function stubFetchForMotResponse(motResponse: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('login.microsoftonline.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'fake-token', expires_in: 3600 }),
      } as Response;
    }
    return motResponse as Response;
  }) as unknown as typeof fetch;
}

describe('getMOTHistory', () => {
  beforeEach(() => {
    // Fresh module each test: cachedToken is module-level state in mot.ts and
    // would otherwise leak a successful token across unrelated test cases.
    vi.resetModules();
  });

  it('returns status "found" with transformed data on a 200 response', async () => {
    stubFetchForMotResponse({
      ok: true,
      status: 200,
      json: async () => ({
        registration: 'AB12CDE',
        make: 'Ford',
        model: 'Focus',
        motTests: [
          {
            completedDate: '2024-01-01T00:00:00.000Z',
            testResult: 'PASSED',
            odometerValue: '50000',
            odometerUnit: 'MI',
            odometerResultType: 'READ',
            motTestNumber: '123',
            dataSource: 'dvsa',
          },
        ],
      }),
    });

    const { getMOTHistory } = await import('./mot');
    const result = await getMOTHistory('AB12 CDE');

    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.data.make).toBe('Ford');
      expect(result.data.motTests).toHaveLength(1);
      expect(result.data.motTests[0].odometerValue).toBe(50000);
    }
  });

  it('returns status "not_found" on a confirmed 404', async () => {
    stubFetchForMotResponse({ ok: false, status: 404 });

    const { getMOTHistory } = await import('./mot');
    const result = await getMOTHistory('AB12 CDE');

    expect(result.status).toBe('not_found');
  });

  it('returns status "failed" on a non-404 API error, never "not_found"', async () => {
    stubFetchForMotResponse({ ok: false, status: 500, text: async () => 'server error' });

    const { getMOTHistory } = await import('./mot');
    const result = await getMOTHistory('AB12 CDE');

    expect(result.status).toBe('failed');
    expect(result.status).not.toBe('not_found');
  });

  it('returns status "failed" when the request throws, never "not_found"', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('login.microsoftonline.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'fake-token', expires_in: 3600 }),
        } as Response;
      }
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const { getMOTHistory } = await import('./mot');
    const result = await getMOTHistory('AB12 CDE');

    expect(result.status).toBe('failed');
    expect(result.status).not.toBe('not_found');
  });

  it('returns status "failed" when the OAuth token request itself fails', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('login.microsoftonline.com')) {
        return { ok: false, status: 401, text: async () => 'bad credentials' } as Response;
      }
      throw new Error('should not reach the MOT endpoint without a token');
    }) as unknown as typeof fetch;

    const { getMOTHistory } = await import('./mot');
    const result = await getMOTHistory('AB12 CDE');

    expect(result.status).toBe('failed');
  });
});
