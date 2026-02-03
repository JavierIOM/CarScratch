// Cheerio removed - caused crashes on Netlify functions

export interface IOMVehicleData {
  registrationNumber: string;
  make?: string;
  model?: string;
  modelVariant?: string;
  category?: string;
  colour?: string;
  cubicCapacity?: number;
  fuelType?: string;
  co2Emissions?: number;
  dateOfFirstRegistration?: string;
  previousUKRegistration?: string;
  dateOfFirstRegistrationIOM?: string;
  wheelPlan?: string;
  taxStatus?: string;
  taxExpiryDate?: string;
  scrapedAt?: string;
  _debug?: {
    url?: string;
    htmlPreview?: string;
    error?: string;
  };
}

// Cache for IoM lookups
const iomCache = new Map<string, { data: IOMVehicleData | null; timestamp: number }>();
const IOM_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const GOV_IM_URL = 'https://services.gov.im/service/VehicleSearch';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Extract set-cookie values from a Response.
 * Uses getSetCookie() if available (Node 18.14+), falls back to raw header parsing.
 */
function extractCookies(res: Response): string[] {
  // Try the modern API first
  if (typeof res.headers.getSetCookie === 'function') {
    try {
      const values = res.headers.getSetCookie();
      if (values && values.length > 0) {
        return values.map(sc => sc.split(';')[0]).filter(Boolean);
      }
    } catch (_e) { /* fall through */ }
  }

  // Fallback: parse the raw 'set-cookie' header
  // In some runtimes headers.get('set-cookie') returns all values joined by ', '
  // but cookie values can also contain commas (e.g. expires=Thu, 01 Jan...).
  // We split on ', ' followed by a known cookie-name pattern.
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];

  const parts = raw.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
  return parts.map(sc => sc.split(';')[0].trim()).filter(Boolean);
}

/**
 * Perform the full search in one go - get session and POST in the same cookie context
 */
async function searchGovIm(registration: string): Promise<{ html: string } | null> {
  const cookieJar = new Map<string, string>();

  const addCookies = (res: Response) => {
    for (const nv of extractCookies(res)) {
      const name = nv.split('=')[0];
      if (name) cookieJar.set(name, nv);
    }
  };

  const getHeaders = () => ({
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Cookie': [...cookieJar.values()].join('; '),
  });

  try {
    // Step 1: Get the search page (follow redirects, collect cookies)
    let currentUrl = GOV_IM_URL;
    let html = '';

    for (let i = 0; i < 4; i++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      let res: Response;
      try {
        res = await fetch(currentUrl, {
          headers: getHeaders(),
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (err) {
        console.error(`[IoM] GET ${i} failed: ${err}`);
        return null;
      } finally {
        clearTimeout(timeout);
      }
      addCookies(res);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        currentUrl = location.startsWith('http') ? location : `https://services.gov.im${location}`;
        await res.text().catch(() => {});
        continue;
      }

      html = await res.text();
      break;
    }

    if (!html) {
      console.error('[IoM] Failed to get search page');
      return null;
    }

    // Extract CSRF token
    const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
    if (!tokenMatch) {
      console.error('[IoM] No CSRF token found');
      return null;
    }
    const csrfToken = tokenMatch[1];

    // Step 2: POST the search (same cookie jar)
    const formData = new URLSearchParams({
      RegMarkNo: registration,
      __RequestVerificationToken: csrfToken,
    });

    const postController = new AbortController();
    const postTimeout = setTimeout(() => postController.abort(), 3000);
    let postRes: Response;
    try {
      postRes = await fetch(GOV_IM_URL, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': GOV_IM_URL,
        },
        body: formData.toString(),
        redirect: 'follow',
        signal: postController.signal,
      });
    } catch (err) {
      console.error(`[IoM] POST failed: ${err}`);
      return null;
    } finally {
      clearTimeout(postTimeout);
    }

    addCookies(postRes);

    if (!postRes.ok) {
      console.error(`[IoM] POST failed: ${postRes.status}`);
      return null;
    }

    const resultHtml = await postRes.text();
    return { html: resultHtml };
  } catch (error) {
    console.error('[IoM] Search failed:', error);
    return null;
  }
}

/**
 * Scrape vehicle data from the Isle of Man government website using direct HTTP requests.
 * No headless browser needed - just follows the session/redirect flow and POSTs the form.
 */
export async function scrapeIOMVehicle(
  registration: string
): Promise<IOMVehicleData | null> {
  try {
    const formattedReg = registration.toUpperCase().replace(/[\s-]+/g, '');
    const normalized = registration.toUpperCase().replace(/\s/g, '');

    // Check cache
    const cached = iomCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < IOM_CACHE_TTL) {
      return cached.data;
    }

    // Perform search (handles session + POST in one cookie context)
    const result = await searchGovIm(formattedReg);
    if (!result) {
      return null;
    }

    const html = result.html;

    // Check for error/not-found
    if (
      html.includes('No vehicle found') ||
      html.includes('was rejected') ||
      html.includes('Vehicle not found') ||
      html.includes('The requested URL was rejected')
    ) {
      return null;
    }

    // Parse all fields - use flexible regex that handles whitespace/newlines
    const findValue = (label: string): string | undefined => {
      // Try multiple patterns
      // Pattern 1: <th>Label</th> followed by <td>Value</td> with possible whitespace/newlines
      const regex1 = new RegExp(`<th[^>]*>\\s*${label}\\s*</th>[\\s\\S]*?<td[^>]*>([^<]+)</td>`, 'i');
      const match1 = html.match(regex1);
      if (match1) return match1[1].trim();

      // Pattern 2: More lenient - just find th containing label then next td
      const regex2 = new RegExp(`<th[^>]*>[^<]*${label}[^<]*</th>\\s*<td[^>]*>\\s*([^<]+)`, 'i');
      const match2 = html.match(regex2);
      if (match2) return match2[1].trim();

      return undefined;
    };

    const make = findValue('Make');
    const modelVal = findValue('Model');

    // If make not found, return debug info
    if (!make) {
      return {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          error: `Make not found. HTML length=${html.length}`,
          htmlPreview: html.substring(0, 500),
        },
      };
    }

    // Parse numeric fields
    const ccStr = findValue('Cubic Capacity');
    const co2Str = findValue('CO2 Emission');

    const vehicleData: IOMVehicleData = {
      registrationNumber: registration,
      scrapedAt: new Date().toISOString(),
      make,
      model: modelVal && !modelVal.includes('Variant') ? modelVal : undefined,
      modelVariant: findValue('Model Variant'),
      category: findValue('Category'),
      colour: findValue('Colour'),
      cubicCapacity: ccStr ? parseInt(ccStr, 10) : undefined,
      fuelType: findValue('Fuel'),
      co2Emissions: co2Str ? parseFloat(co2Str) : undefined,
      dateOfFirstRegistration: findValue('Date of First Registration'),
      previousUKRegistration: findValue('Previous Registration Number'),
      dateOfFirstRegistrationIOM: findValue('Date of First Registration on IOM'),
      wheelPlan: findValue('Wheel Plan'),
      taxStatus: findValue('Status of Vehicle Licence'),
      taxExpiryDate: findValue('Expiry Date of Vehicle Licence'),
    };

    // Cache and return
    iomCache.set(normalized, { data: vehicleData, timestamp: Date.now() });
    return vehicleData;
  } catch (err) {
    console.error('[IoM] Crash:', err);
    return null;
  }
}

/**
 * Convert IoM vehicle data to our standard VehicleData format
 */
export function iomToVehicleData(iom: IOMVehicleData): import('./types').VehicleData {
  let taxStatus: 'Taxed' | 'SORN' | 'Untaxed' | 'Not Taxed for on Road Use' = 'Untaxed';
  if (iom.taxStatus) {
    const lower = iom.taxStatus.toLowerCase();
    if (lower.includes('active') || lower.includes('valid')) {
      taxStatus = 'Taxed';
    } else if (lower.includes('sorn')) {
      taxStatus = 'SORN';
    }
  }

  let yearOfManufacture = 0;
  if (iom.dateOfFirstRegistration) {
    const yearMatch = iom.dateOfFirstRegistration.match(/(\d{4})/);
    if (yearMatch) {
      yearOfManufacture = parseInt(yearMatch[1], 10);
    }
  }

  return {
    registrationNumber: iom.registrationNumber,
    make: iom.make || 'Unknown',
    model: iom.modelVariant || iom.model,
    colour: iom.colour || 'Unknown',
    fuelType: iom.fuelType || 'Unknown',
    engineCapacity: iom.cubicCapacity || 0,
    co2Emissions: iom.co2Emissions,
    yearOfManufacture,
    taxStatus,
    taxDueDate: iom.taxExpiryDate,
    motStatus: 'No details held by DVLA',
    wheelplan: iom.wheelPlan,
  };
}
