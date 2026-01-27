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
    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: `
            module.exports = async ({ page }) => {
              const searchReg = "${formattedReg}";

              // Go to the vehicle search page
              await page.goto('https://services.gov.im/service/VehicleSearch', {
                waitUntil: 'networkidle2',
                timeout: 30000
              });

              // Wait for and fill in the registration input
              await page.waitForSelector('input[name="reg"], input[id="reg"], input[type="text"]', { timeout: 10000 });

              // Try different possible selectors for the input field
              const inputSelectors = [
                'input[name="reg"]',
                'input[id="reg"]',
                'input[name="registrationNumber"]',
                'input[id="registrationNumber"]',
                'input[name="vrm"]',
                'input[placeholder*="registration" i]',
                'input[placeholder*="number" i]',
                'form input[type="text"]'
              ];

              let inputFound = false;
              for (const selector of inputSelectors) {
                try {
                  const input = await page.$(selector);
                  if (input) {
                    await input.click({ clickCount: 3 }); // Select all
                    await input.type(searchReg);
                    inputFound = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }

              if (!inputFound) {
                return { error: 'Could not find registration input field', html: await page.content() };
              }

              // Find and click the submit button
              const buttonSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Search")',
                'button:has-text("Find")',
                'button:has-text("Look")',
                '.btn-primary',
                'form button'
              ];

              let buttonClicked = false;
              for (const selector of buttonSelectors) {
                try {
                  const button = await page.$(selector);
                  if (button) {
                    await Promise.all([
                      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
                      button.click()
                    ]);
                    buttonClicked = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }

              // If no button found, try pressing Enter
              if (!buttonClicked) {
                await page.keyboard.press('Enter');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
              }

              // Wait a moment for content to load
              await new Promise(r => setTimeout(r, 2000));

              // Get the page content
              const html = await page.content();
              const url = page.url();

              return { html, url };
            };
          `,
          context: {},
        }),
      }
    );

    if (!response.ok) {
      console.error(`Browserless returned ${response.status}: ${await response.text()}`);
      return null;
    }

    const result = await response.json();

    if (result.error) {
      console.error('Browserless function error:', result.error);
      // Log the HTML for debugging if available
      if (result.html) {
        console.log('Page HTML preview:', result.html.substring(0, 500));
      }
      return null;
    }

    const html = result.html || '';
    const $ = cheerio.load(html);

    console.log('IoM search URL:', result.url);
    console.log('IoM HTML preview:', html.substring(0, 500));

    // Check for error pages
    if (
      html.includes('No vehicle found') ||
      html.includes('was rejected') ||
      html.includes('Vehicle not found')
    ) {
      iomCache.set(normalized, { data: null, timestamp: Date.now() });
      return null;
    }

    // Parse the vehicle data from the table
    const data: IOMVehicleData = {
      registrationNumber: registration,
      scrapedAt: new Date().toISOString(),
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
    data.make = findValue('Make');
    data.model = findValue('Model') && !findValue('Model')?.includes('Variant')
      ? findValue('Model')
      : undefined;
    data.modelVariant = findValue('Model Variant') || findValue('Variant');
    data.category = findValue('Category');
    data.colour = findValue('Colour') || findValue('Color');
    data.fuelType = findValue('Fuel');

    // Cubic capacity
    const ccStr = findValue('Cubic Capacity');
    if (ccStr) {
      const ccMatch = ccStr.match(/(\d+)/);
      if (ccMatch) {
        data.cubicCapacity = parseInt(ccMatch[1], 10);
      }
    }

    // CO2
    const co2Str = findValue('CO2 Emission');
    if (co2Str) {
      const co2Match = co2Str.match(/(\d+)/);
      if (co2Match) {
        data.co2Emissions = parseInt(co2Match[1], 10);
      }
    }

    // Dates
    data.dateOfFirstRegistration = findValue('Date of First Registration');
    data.previousUKRegistration = findValue('Previous Registration Number');
    data.dateOfFirstRegistrationIOM = findValue('Date of First Registration on IOM');
    data.wheelPlan = findValue('Wheel Plan');

    // Tax status
    const taxStatusStr = findValue('Status of Vehicle Licence');
    data.taxStatus = taxStatusStr;
    data.taxExpiryDate = findValue('Expiry Date of Vehicle Licence');

    // Cache the result
    iomCache.set(normalized, { data, timestamp: Date.now() });

    return data;
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
