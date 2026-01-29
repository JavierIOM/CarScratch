import * as cheerio from 'cheerio';

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
const GOV_IM_LAUNCH_URL = 'https://services.gov.im/onlineservices/launchonlineservices.iom';
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
 * Follow redirects manually, collecting cookies at each hop.
 * Returns the final HTML body and all accumulated cookies.
 */
async function fetchWithCookies(
  url: string,
  maxRedirects = 8,
): Promise<{ html: string; cookies: string } | null> {
  const cookieJar = new Map<string, string>(); // name -> name=value

  const addCookies = (res: Response) => {
    for (const nv of extractCookies(res)) {
      const name = nv.split('=')[0];
      if (name) cookieJar.set(name, nv);
    }
  };

  const headers = () => ({
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Cookie': [...cookieJar.values()].join('; '),
  });

  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(currentUrl, { headers: headers(), redirect: 'manual', signal: controller.signal });
    } catch (err) {
      console.error(`[IoM] Fetch failed at hop ${i}: ${err}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
    addCookies(res);

    console.log(`[IoM] ${i}: ${res.status} ${currentUrl} (cookies: ${cookieJar.size})`);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      currentUrl = location.startsWith('http') ? location : `https://services.gov.im${location}`;
      // consume body to free connection
      await res.text().catch(() => {});
      continue;
    }

    // Got a non-redirect response
    const html = await res.text();
    return { html, cookies: [...cookieJar.values()].join('; ') };
  }

  console.error('[IoM] Too many redirects or no final response');
  return null;
}

/**
 * Get a session from gov.im by following the redirect dance.
 * Returns the session cookies and CSRF token needed for the search POST.
 */
async function getGovImSession(): Promise<{ cookies: string; csrfToken: string } | null> {
  try {
    const result = await fetchWithCookies(GOV_IM_URL);
    if (!result) return null;

    // Extract CSRF token from the HTML
    const tokenMatch = result.html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
    if (!tokenMatch) {
      console.error('[IoM] Could not find CSRF token in page HTML');
      console.error('[IoM] HTML preview:', result.html.substring(0, 500));
      return null;
    }

    return {
      cookies: result.cookies,
      csrfToken: tokenMatch[1],
    };
  } catch (error) {
    console.error('[IoM] Failed to get session:', error);
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
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  // Check cache
  const cached = iomCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < IOM_CACHE_TTL) {
    return cached.data;
  }

  try {
    const formattedReg = registration.toUpperCase().replace(/[\s-]+/g, '');

    console.log(`[IoM] Looking up ${formattedReg}`);

    // Get session cookies and CSRF token
    const session = await getGovImSession();
    if (!session) {
      console.error('[IoM] Could not establish session with gov.im');
      return null;
    }

    console.log(`[IoM] Got session, CSRF token length: ${session.csrfToken.length}`);

    // POST the search form
    const body = new URLSearchParams({
      RegMarkNo: formattedReg,
      __RequestVerificationToken: session.csrfToken,
    });

    const postController = new AbortController();
    const postTimeout = setTimeout(() => postController.abort(), 8000);
    let searchRes: Response;
    try {
      searchRes = await fetch(GOV_IM_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': GOV_IM_URL,
          'Cookie': session.cookies,
        },
        body: body.toString(),
        signal: postController.signal,
      });
    } catch (err) {
      console.error(`[IoM] POST fetch failed: ${err}`);
      return null;
    } finally {
      clearTimeout(postTimeout);
    }

    if (!searchRes.ok) {
      console.error(`[IoM] Search POST returned ${searchRes.status}`);
      return {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: { error: `gov.im returned HTTP ${searchRes.status}` },
      };
    }

    const html = await searchRes.text();
    console.log(`[IoM] Got response, length: ${html.length}`);

    // Check for error/not-found
    if (
      html.includes('No vehicle found') ||
      html.includes('was rejected') ||
      html.includes('Vehicle not found') ||
      html.includes('The requested URL was rejected')
    ) {
      const errorData: IOMVehicleData = {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          error: 'Vehicle not found or request rejected',
          htmlPreview: html.substring(0, 500),
        },
      };
      iomCache.set(normalized, { data: errorData, timestamp: Date.now() });
      return errorData;
    }

    // Parse with Cheerio
    const $ = cheerio.load(html);

    const vehicleData: IOMVehicleData = {
      registrationNumber: registration,
      scrapedAt: new Date().toISOString(),
    };

    // gov.im uses: <th>Label</th>\n<td>Value</td>
    const findValue = (label: string): string | undefined => {
      // Cheerio approach - cleanest for this table structure
      const th = $(`th:contains("${label}")`).first();
      if (th.length) {
        const td = th.next('td');
        if (td.length && td.text().trim()) {
          return td.text().trim();
        }
      }

      // Regex fallback
      const match = html.match(new RegExp(`<th[^>]*>[^<]*${label}[^<]*</th>\\s*<td[^>]*>\\s*([^<]+)`, 'i'));
      if (match && match[1].trim()) {
        return match[1].trim();
      }

      return undefined;
    };

    vehicleData.make = findValue('Make');
    const modelVal = findValue('Model');
    vehicleData.model = modelVal && !modelVal.includes('Variant') ? modelVal : undefined;
    vehicleData.modelVariant = findValue('Model Variant') || findValue('Variant');
    vehicleData.category = findValue('Category');
    vehicleData.colour = findValue('Colour') || findValue('Color');
    vehicleData.fuelType = findValue('Fuel');

    const ccStr = findValue('Cubic Capacity');
    if (ccStr) {
      const ccMatch = ccStr.match(/(\d+)/);
      if (ccMatch) vehicleData.cubicCapacity = parseInt(ccMatch[1], 10);
    }

    const co2Str = findValue('CO2 Emission');
    if (co2Str) {
      const co2Match = co2Str.match(/(\d+)/);
      if (co2Match) vehicleData.co2Emissions = parseInt(co2Match[1], 10);
    }

    vehicleData.dateOfFirstRegistration = findValue('Date of First Registration');
    vehicleData.previousUKRegistration = findValue('Previous Registration Number');
    vehicleData.dateOfFirstRegistrationIOM = findValue('Date of First Registration on IOM');
    vehicleData.wheelPlan = findValue('Wheel Plan');
    vehicleData.taxStatus = findValue('Status of Vehicle Licence');
    vehicleData.taxExpiryDate = findValue('Expiry Date of Vehicle Licence');

    console.log(`[IoM] Parsed: ${vehicleData.make} ${vehicleData.modelVariant || vehicleData.model || ''}`);

    // Cache the result
    iomCache.set(normalized, { data: vehicleData, timestamp: Date.now() });

    return vehicleData;
  } catch (error) {
    console.error('[IoM] Error scraping vehicle:', error);
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
