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
    // Try the registration without any separators - gov.im may expect plain format
    const formattedReg = registration.toUpperCase().replace(/[\s-]+/g, '');

    // Use Browserless /function API to interact with the form
    // This runs Puppeteer code that fills in and submits the search form
    // Using stealth techniques to avoid bot detection
    const puppeteerCode = `
export default async function ({ page }) {
  const searchReg = "${formattedReg}";

  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Set realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
    window.chrome = { runtime: {} };
  });

  // Go to the vehicle search page
  await page.goto('https://services.gov.im/service/VehicleSearch', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait a bit for any JS to run
  await new Promise(r => setTimeout(r, 1000));

  // Wait for page to load
  await page.waitForSelector('input', { timeout: 10000 }).catch(() => {});

  // Debug: Get all form info
  const formInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    return {
      inputs: inputs.map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder,
        className: i.className
      })),
      buttons: buttons.map(b => ({
        type: b.type,
        text: b.textContent?.trim(),
        className: b.className
      }))
    };
  });

  // Find the registration input using exact selector from gov.im
  const input = await page.$('#RegMarkNo');
  if (!input) {
    const html = await page.content();
    return {
      data: {
        error: 'Could not find #RegMarkNo input',
        html: html.substring(0, 2000),
        formInfo: JSON.stringify(formInfo)
      },
      type: 'application/json'
    };
  }

  // Clear and type the registration
  await input.click({ clickCount: 3 });
  await input.type(searchReg, { delay: 50 });

  // Small delay after typing
  await new Promise(r => setTimeout(r, 500));

  // Check if input has focus and value
  const inputValue = await input.evaluate(el => el.value);
  const hasFocus = await input.evaluate(el => document.activeElement === el);

  // Make sure input has focus
  await input.focus();
  await new Promise(r => setTimeout(r, 200));

  // Try multiple submission methods in order
  let submitted = false;

  // Method 1: Press Enter key (most natural user action)
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.keyboard.press('Enter')
    ]);
    submitted = true;
  } catch (e1) {
    // Method 2: Click the submit button directly
    try {
      const submitBtn = await page.$('button.btn-primary[type="submit"]');
      if (submitBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
          submitBtn.click()
        ]);
        submitted = true;
      }
    } catch (e2) {
      // Navigation didn't happen
    }
  }

  // Wait for results regardless
  await new Promise(r => setTimeout(r, 2000));

  // Check if URL changed or if we have vehicle data on the page
  const currentUrl = page.url();
  const hasResults = await page.evaluate(() => {
    // Look for typical vehicle result elements
    return document.body.innerHTML.includes('Make') ||
           document.body.innerHTML.includes('Vehicle Details') ||
           document.body.innerHTML.includes('Model');
  });

  // Get final state
  const html = await page.content();
  const url = page.url();

  // Include extra debug info
  return {
    data: {
      html,
      url,
      formInfo: JSON.stringify(formInfo),
      inputValue,
      submitted,
      hasResults,
      hasFocus
    },
    type: 'application/json'
  };
}
`;

    // Use stealth flag to avoid bot detection
    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}&stealth`,
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
          error: respData.error + (respData.formInfo ? ' Forms: ' + respData.formInfo : ''),
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
        error: respData.formInfo ? 'Forms found: ' + respData.formInfo : undefined,
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
