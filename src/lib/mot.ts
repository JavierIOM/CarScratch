import type { MOTHistory, MOTTest, MOTDefect } from './types';

const MOT_CLIENT_ID = import.meta.env.MOT_CLIENT_ID;
const MOT_CLIENT_SECRET = import.meta.env.MOT_CLIENT_SECRET;
const MOT_API_KEY = import.meta.env.MOT_API_KEY;
const MOT_TENANT_ID = import.meta.env.MOT_TENANT_ID;

const TOKEN_URL = `https://login.microsoftonline.com/${MOT_TENANT_ID}/oauth2/v2.0/token`;
const MOT_API_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles';
const TOKEN_SCOPE = 'https://tapi.dvsa.gov.uk/.default';

// Cache the access token (valid for ~60 minutes)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an OAuth 2.0 access token from Microsoft Entra ID
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MOT_CLIENT_ID,
    client_secret: MOT_CLIENT_SECRET,
    scope: TOKEN_SCOPE,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MOT token request failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

/**
 * Fetch MOT history for a vehicle by registration number
 */
export async function getMOTHistory(registration: string): Promise<MOTHistory | null> {
  if (!MOT_CLIENT_ID || !MOT_CLIENT_SECRET || !MOT_API_KEY || !MOT_TENANT_ID) {
    console.warn('MOT API credentials not configured, skipping MOT lookup');
    return null;
  }

  const clean = registration.toUpperCase().replace(/\s/g, '');

  try {
    const token = await getAccessToken();

    const res = await fetch(`${MOT_API_BASE}/registration/${clean}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-API-Key': MOT_API_KEY,
      },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`MOT API error (${res.status}): ${text}`);
      return null;
    }

    const data = await res.json() as MOTApiResponse;

    return transformResponse(data, clean);
  } catch (err) {
    console.error('MOT API request failed:', err);
    return null;
  }
}

// --- API response types ---

interface MOTApiResponse {
  registration?: string;
  make?: string;
  model?: string;
  firstUsedDate?: string;
  fuelType?: string;
  primaryColour?: string;
  hasOutstandingRecall?: string;
  motTests?: MOTApiTest[];
  // NewRegVehicleResponse fields
  motTestDueDate?: string;
  manufactureYear?: string;
}

interface MOTApiTest {
  completedDate: string;
  testResult: 'PASSED' | 'FAILED';
  expiryDate?: string;
  odometerValue?: string;
  odometerUnit?: 'MI' | 'KM' | null;
  odometerResultType: string;
  motTestNumber?: string;
  dataSource: string;
  defects?: MOTApiDefect[];
}

interface MOTApiDefect {
  text?: string;
  type?: string;
  dangerous?: boolean;
}

// --- Transform API response to our types ---

function transformResponse(data: MOTApiResponse, registration: string): MOTHistory {
  const tests: MOTTest[] = (data.motTests || []).map(transformTest);

  // Sort by date descending (most recent first)
  tests.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());

  return {
    registration: data.registration || registration,
    make: data.make || '',
    model: data.model || '',
    firstUsedDate: data.firstUsedDate,
    fuelType: data.fuelType,
    primaryColour: data.primaryColour,
    motTests: tests,
  };
}

function transformTest(test: MOTApiTest): MOTTest {
  // Parse odometer - API returns string
  let odometerValue = 0;
  if (test.odometerValue && test.odometerResultType === 'READ') {
    odometerValue = parseInt(test.odometerValue.replace(/,/g, ''), 10) || 0;
  }

  const defects: MOTDefect[] = (test.defects || []).map(d => ({
    text: d.text || '',
    type: mapDefectType(d.type),
    dangerous: d.dangerous || false,
  }));

  return {
    completedDate: test.completedDate,
    testResult: test.testResult,
    expiryDate: test.expiryDate,
    odometerValue,
    odometerUnit: (test.odometerUnit?.toLowerCase() as 'mi' | 'km') || 'mi',
    motTestNumber: test.motTestNumber || '',
    rfrAndComments: defects,
  };
}

function mapDefectType(type?: string): MOTDefect['type'] {
  if (!type) return 'ADVISORY';
  const upper = type.toUpperCase();
  switch (upper) {
    case 'ADVISORY': return 'ADVISORY';
    case 'DANGEROUS': return 'DANGEROUS';
    case 'FAIL': return 'FAIL';
    case 'MAJOR': return 'MAJOR';
    case 'MINOR': return 'MINOR';
    case 'PRS': return 'PRS';
    default: return 'ADVISORY';
  }
}
