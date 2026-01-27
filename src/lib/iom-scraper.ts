import * as cheerio from 'cheerio';
import { formatManxPlateForApi } from './iom-detector';

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
  // Debug info
  _debug?: {
    url?: string;
    htmlPreview?: string;
    error?: string;
  };
}

// Cache for IoM lookups
const iomCache = new Map<string, { data: IOMVehicleData | null; timestamp: number }>();
const IOM_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours (IoM data changes rarely)

/**
 * Scrape vehicle data from the Isle of Man government website using Browserless
 * The gov.im site uses a form-based search, so we need to interact with the page
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

  const browserlessApiKey = import.meta.env.BROWSERLESS_API_KEY;

  if (!browserlessApiKey) {
    console.warn('BROWSERLESS_API_KEY not configured, skipping IoM lookup');
    return null;
  }

  try {
    const formattedReg = formatManxPlateForApi(registration);

    // Use Browserless /function API to interact with the form
    // This runs Puppeteer code that fills in and submits the search form
    const puppeteerCode = `
export default async function ({ page }) {
  const searchReg = "${formattedReg}";

  // Go to the vehicle search page
  await page.goto('https://services.gov.im/service/VehicleSearch', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for page to load and find any input
  await page.waitForSelector('input', { timeout: 10000 }).catch(() => {});

  // Try different possible selectors for the input field
  const inputSelectors = [
    'input[name="reg"]',
    'input[id="reg"]',
    'input[name="registrationNumber"]',
    'input[id="registrationNumber"]',
    'input[name="vrm"]',
    '#registrationNumber',
    '.registration-input',
    'input[type="text"]'
  ];

  let inputFound = false;
  for (const selector of inputSelectors) {
    try {
      const input = await page.$(selector);
      if (input) {
        await input.click({ clickCount: 3 });
        await input.type(searchReg, { delay: 50 });
        inputFound = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!inputFound) {
    const html = await page.content();
    return {
      data: { error: 'Could not find input', html: html.substring(0, 2000) },
      type: 'application/json'
    };
  }

  // Find and click the submit button
  const buttonSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    '.btn-primary',
    'button.btn',
    'form button',
    'button'
  ];

  for (const selector of buttonSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const buttonText = await page.evaluate(el => el.textContent || el.value || '', button);
        // Skip non-search buttons
        if (buttonText.toLowerCase().includes('back') || buttonText.toLowerCase().includes('cancel')) {
          continue;
        }
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
          button.click()
        ]);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  // Wait for content to load
  await new Promise(r => setTimeout(r, 2000));

  const html = await page.content();
  const url = page.url();

  return {
    data: { html, url },
    type: 'application/json'
  };
}
`;

    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/javascript',
        },
        body: puppeteerCode,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Browserless returned ${response.status}: ${errorText}`);
      // Return debug data so we can see what went wrong
      return {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          error: `Browserless HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        },
      };
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonErr) {
      const text = await response.text();
      return {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          error: 'Failed to parse Browserless response as JSON',
          htmlPreview: text.substring(0, 500),
        },
      };
    }

    // The function returns { data: { html, url } } or { data: { error, html } }
    const respData = result.data || result;

    if (respData.error) {
      console.error('Browserless function error:', respData.error);
      return {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          error: respData.error,
          htmlPreview: respData.html?.substring(0, 500),
        },
      };
    }

    const html = respData.html || '';
    const $ = cheerio.load(html);

    console.log('IoM search URL:', respData.url);
    console.log('IoM HTML preview:', html.substring(0, 500));

    // Check for error pages
    if (
      html.includes('No vehicle found') ||
      html.includes('was rejected') ||
      html.includes('Vehicle not found')
    ) {
      const errorData: IOMVehicleData = {
        registrationNumber: registration,
        scrapedAt: new Date().toISOString(),
        _debug: {
          url: respData.url,
          error: 'Gov.im returned no vehicle found',
          htmlPreview: html.substring(0, 500),
        },
      };
      iomCache.set(normalized, { data: errorData, timestamp: Date.now() });
      return errorData;
    }

    // Parse the vehicle data from the table
    const vehicleData: IOMVehicleData = {
      registrationNumber: registration,
      scrapedAt: new Date().toISOString(),
      _debug: {
        url: respData.url,
        htmlPreview: html.substring(0, 500),
      },
    };

    // The IoM site uses a table with rows like:
    // <tr><td>Make</td><td>NISSAN</td></tr>
    // Or it might use a definition list or other structure

    // Helper to find value by label
    const findValue = (label: string): string | undefined => {
      // Try table row format
      const tableCell = $(`td:contains("${label}")`).first().next('td');
      if (tableCell.length && tableCell.text().trim()) {
        return tableCell.text().trim();
      }

      // Try definition list format
      const dt = $(`dt:contains("${label}")`).first();
      const dd = dt.next('dd');
      if (dd.length && dd.text().trim()) {
        return dd.text().trim();
      }

      // Try generic text pattern
      const regex = new RegExp(`${label}[:\\s]*([^<\\n]+)`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }

      return undefined;
    };

    // Extract all fields
    vehicleData.make = findValue('Make');
    vehicleData.model = findValue('Model') && !findValue('Model')?.includes('Variant')
      ? findValue('Model')
      : undefined;
    vehicleData.modelVariant = findValue('Model Variant') || findValue('Variant');
    vehicleData.category = findValue('Category');
    vehicleData.colour = findValue('Colour') || findValue('Color');
    vehicleData.fuelType = findValue('Fuel');

    // Cubic capacity
    const ccStr = findValue('Cubic Capacity');
    if (ccStr) {
      const ccMatch = ccStr.match(/(\d+)/);
      if (ccMatch) {
        vehicleData.cubicCapacity = parseInt(ccMatch[1], 10);
      }
    }

    // CO2
    const co2Str = findValue('CO2 Emission');
    if (co2Str) {
      const co2Match = co2Str.match(/(\d+)/);
      if (co2Match) {
        vehicleData.co2Emissions = parseInt(co2Match[1], 10);
      }
    }

    // Dates
    vehicleData.dateOfFirstRegistration = findValue('Date of First Registration');
    vehicleData.previousUKRegistration = findValue('Previous Registration Number');
    vehicleData.dateOfFirstRegistrationIOM = findValue('Date of First Registration on IOM');
    vehicleData.wheelPlan = findValue('Wheel Plan');

    // Tax status
    const taxStatusStr = findValue('Status of Vehicle Licence');
    vehicleData.taxStatus = taxStatusStr;
    vehicleData.taxExpiryDate = findValue('Expiry Date of Vehicle Licence');

    // Cache the result
    iomCache.set(normalized, { data: vehicleData, timestamp: Date.now() });

    return vehicleData;
  } catch (error) {
    console.error('Error scraping IoM vehicle:', error);
    return null;
  }
}

/**
 * Convert IoM vehicle data to our standard VehicleData format
 */
export function iomToVehicleData(iom: IOMVehicleData): import('./types').VehicleData {
  // Parse tax status
  let taxStatus: 'Taxed' | 'SORN' | 'Untaxed' | 'Not Taxed for on Road Use' = 'Untaxed';
  if (iom.taxStatus) {
    const lower = iom.taxStatus.toLowerCase();
    if (lower.includes('active') || lower.includes('valid')) {
      taxStatus = 'Taxed';
    } else if (lower.includes('sorn')) {
      taxStatus = 'SORN';
    }
  }

  // Parse year from first registration date
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
    motStatus: 'No details held by DVLA', // IoM doesn't have MOT in same way
    wheelplan: iom.wheelPlan,
  };
}
