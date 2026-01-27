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
  try {
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

  // Find the registration input using evaluate (more reliable than page.$)
  const inputExists = await page.evaluate(() => !!document.querySelector('#RegMarkNo'));

  if (!inputExists) {
    const html = await page.content();
    return {
      data: {
        error: 'Could not find #RegMarkNo input via evaluate',
        html: html.substring(0, 2000),
        formInfo: JSON.stringify(formInfo)
      },
      type: 'application/json'
    };
  }

  // Type the registration and submit using evaluate
  await page.evaluate((reg) => {
    const input = document.querySelector('#RegMarkNo');
    if (input) {
      input.value = reg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, searchReg);

  // Small delay after typing
  await new Promise(r => setTimeout(r, 500));

  // Submit the form via evaluate
  const submitResult = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn) {
      btn.click();
      return 'clicked';
    }
    const form = document.querySelector('form');
    if (form) {
      form.submit();
      return 'submitted';
    }
    return 'no_element';
  });

  // Wait for navigation/result
  await new Promise(r => setTimeout(r, 5000));

  // Get final state
  const html = await page.content();
  const url = page.url();

  // Check if we got results
  const hasResults = html.includes('Make') || html.includes('NISSAN') || html.includes('Vehicle Details');
  const contentChanged = !html.includes('Enter a registration');

  // Capture context around "Make" to understand structure
  let makeContext = '';
  const makeIndex = html.indexOf('<th>Make</th>');
  if (makeIndex !== -1) {
    // Capture more after Make to include the value
    makeContext = html.substring(makeIndex, Math.min(html.length, makeIndex + 100));
  } else {
    // Fallback: search for just "Make"
    const altIndex = html.indexOf('Make');
    if (altIndex !== -1) {
      makeContext = 'altSearch:' + html.substring(altIndex, Math.min(html.length, altIndex + 100));
    }
  }

    return {
      data: {
        html,
        url,
        formInfo: JSON.stringify(formInfo),
        inputValue: searchReg,
        submitResult,
        contentChanged,
        hasResults,
        makeContext
      },
      type: 'application/json'
    };
  } catch (err) {
    return {
      data: {
        error: 'Puppeteer error: ' + err.message,
        stack: err.stack
      },
      type: 'application/json'
    };
  }
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
    console.log('IoM makeContext:', respData.makeContext);

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
        error: [
          respData.inputValue ? 'Input: ' + respData.inputValue : null,
          respData.submitResult ? 'Submit: ' + respData.submitResult : null,
          respData.hasResults !== undefined ? 'HasResults: ' + respData.hasResults : null,
          respData.makeContext ? 'Context: ' + respData.makeContext : null,
        ].filter(Boolean).join(' | '),
      },
    };

    // The IoM site uses a table with rows like:
    // <tr><td>Make</td><td>NISSAN</td></tr>
    // Or it might use a definition list or other structure

    // Helper to find value by label - tries multiple HTML patterns
    const findValue = (label: string): string | undefined => {
      // Pattern 0: Exact gov.im format: <th>Label</th> <td>VALUE</td>
      // Note: there's often a space or whitespace between </th> and <td>
      const govImMatch = html.match(new RegExp(`<th>${label}</th>\\s*<td>([^<]+)</td>`, 'i'));
      if (govImMatch && govImMatch[1].trim()) {
        return govImMatch[1].trim();
      }

      // Pattern 1: th/td table with attributes (e.g., <th class="...">Make</th><td>NISSAN</td>)
      const thMatch = html.match(new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([^<]+)</td>`, 'i'));
      if (thMatch && thMatch[1].trim()) {
        return thMatch[1].trim();
      }

      // Pattern 2: td/td table (e.g., <td>Make</td><td>NISSAN</td>)
      const tdMatch = html.match(new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([^<]+)</td>`, 'i'));
      if (tdMatch && tdMatch[1].trim()) {
        return tdMatch[1].trim();
      }

      // Pattern 3: label after closing tag (e.g., >Make</th><td>NISSAN</td>)
      const afterTagMatch = html.match(new RegExp(`>${label}</[^>]+>\\s*<[^>]+>([^<]+)<`, 'i'));
      if (afterTagMatch && afterTagMatch[1].trim()) {
        return afterTagMatch[1].trim();
      }

      // Pattern 4: Definition list
      const dlMatch = html.match(new RegExp(`<dt[^>]*>\\s*${label}\\s*</dt>\\s*<dd[^>]*>([^<]+)</dd>`, 'i'));
      if (dlMatch && dlMatch[1].trim()) {
        return dlMatch[1].trim();
      }

      // Pattern 5: Generic colon format (e.g., Make: NISSAN)
      const colonMatch = html.match(new RegExp(`${label}\\s*:\\s*([^<\\n,]+)`, 'i'));
      if (colonMatch && colonMatch[1].trim()) {
        return colonMatch[1].trim();
      }

      // Try Cheerio as fallback
      const thCell = $(`th:contains("${label}")`).first().next('td');
      if (thCell.length && thCell.text().trim()) {
        return thCell.text().trim();
      }

      const tdCell = $(`td:contains("${label}")`).first().next('td');
      if (tdCell.length && tdCell.text().trim()) {
        return tdCell.text().trim();
      }

      return undefined;
    };

    // Debug: Try direct regex on html first
    const directMakeMatch = html.match(/<th>Make<\/th>\s*<td>([^<]+)<\/td>/i);

    // Always add debug info about regex result
    vehicleData._debug!.error = (vehicleData._debug?.error || '') +
      ' | RegexResult: ' + (directMakeMatch ? 'matched=' + directMakeMatch[1] : 'no match');

    if (directMakeMatch) {
      vehicleData.make = directMakeMatch[1].trim();
    }

    // Fall back to findValue
    if (!vehicleData.make) {
      vehicleData.make = findValue('Make');
    }
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
