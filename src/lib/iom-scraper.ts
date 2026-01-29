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
 * Get a session from gov.im by following the redirect dance.
 * Returns the session cookies and CSRF token needed for the search POST.
 */
async function getGovImSession(): Promise<{ cookies: string; csrfToken: string } | null> {
  try {
    // Step 1: Hit the launch URL to get session cookies
    const launchRes = await fetch(`${GOV_IM_LAUNCH_URL}?redirect=/service/VehicleSearch`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      redirect: 'manual',
    });

    // Collect cookies from this response
    const cookies: string[] = [];
    const setCookieHeaders = launchRes.headers.getSetCookie?.() ?? [];
    for (const sc of setCookieHeaders) {
      const nameValue = sc.split(';')[0];
      if (nameValue) cookies.push(nameValue);
    }

    console.log(`[IoM] Launch response: ${launchRes.status}, cookies: ${cookies.length}`);

    // Step 2: Follow redirect to the search page with cookies
    const searchRes = await fetch(GOV_IM_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cookie': cookies.join('; '),
      },
      redirect: 'manual',
    });

    // If we get another redirect, follow it and collect more cookies
    const moreCookies = searchRes.headers.getSetCookie?.() ?? [];
    for (const sc of moreCookies) {
      const nameValue = sc.split(';')[0];
      if (nameValue) cookies.push(nameValue);
    }

    // We may need to follow another redirect
    let html = '';
    if (searchRes.status >= 300 && searchRes.status < 400) {
      const location = searchRes.headers.get('location');
      if (location) {
        const fullUrl = location.startsWith('http') ? location : `https://services.gov.im${location}`;
        const finalRes = await fetch(fullUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
            'Cookie': cookies.join('; '),
          },
          redirect: 'manual',
        });

        const evenMoreCookies = finalRes.headers.getSetCookie?.() ?? [];
        for (const sc of evenMoreCookies) {
          const nameValue = sc.split(';')[0];
          if (nameValue) cookies.push(nameValue);
        }

        // May need one more follow if still redirecting
        if (finalRes.status >= 300 && finalRes.status < 400) {
          const loc2 = finalRes.headers.get('location');
          if (loc2) {
            const fullUrl2 = loc2.startsWith('http') ? loc2 : `https://services.gov.im${loc2}`;
            const res2 = await fetch(fullUrl2, {
              headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-GB,en;q=0.9',
                'Cookie': cookies.join('; '),
              },
            });
            const moreCk = res2.headers.getSetCookie?.() ?? [];
            for (const sc of moreCk) {
              const nameValue = sc.split(';')[0];
              if (nameValue) cookies.push(nameValue);
            }
            html = await res2.text();
          }
        } else {
          html = await finalRes.text();
        }
      }
    } else {
      html = await searchRes.text();
    }

    // Extract CSRF token from the HTML
    const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
    if (!tokenMatch) {
      console.error('[IoM] Could not find CSRF token in page HTML');
      console.error('[IoM] HTML preview:', html.substring(0, 500));
      return null;
    }

    return {
      cookies: cookies.join('; '),
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

    const searchRes = await fetch(GOV_IM_URL, {
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
    });

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
