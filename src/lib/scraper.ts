import * as cheerio from 'cheerio';

export interface ScrapedVehicleData {
  // Basic info
  manufacturer?: string;
  model?: string;
  modelDetail?: string;
  colour?: string;
  bodyStyle?: string;
  fuelType?: string;
  engineSize?: string;
  euroStatus?: string;
  transmission?: string;
  yearOfManufacture?: number;

  // Performance
  bhp?: number;
  topSpeed?: string;
  zeroToSixty?: string;

  // Status
  insuranceGroup?: string;
  motStatus?: string;
  taxStatus?: string;
  ulezCompliant?: boolean;
  cazCompliant?: boolean;

  // Market data
  previousPrice?: string;
  previousMileage?: string;

  // Location
  registrationLocation?: string;

  // Meta
  scrapedFrom?: string;
  scrapedAt?: string;
}

// Simple in-memory cache (survives within a single function invocation)
const cache = new Map<string, { data: ScrapedVehicleData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Rate limiting - track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
}

export async function scrapeTotalCarCheck(
  registration: string
): Promise<ScrapedVehicleData | null> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  // Check cache first
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    await rateLimit();

    const url = `https://www.checkcardetails.co.uk/cardetails/${encodeURIComponent(normalized)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      console.error(`CheckCarDetails returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check if we got a valid result page
    if (
      html.includes('No vehicle found') ||
      html.includes('Please enter a valid') ||
      html.includes('Vehicle not found')
    ) {
      return null;
    }

    const data: ScrapedVehicleData = {
      scrapedFrom: 'checkcardetails.co.uk',
      scrapedAt: new Date().toISOString(),
    };

    // Helper: extract value from table rows where label is in first td, value in second td
    const extractField = (label: string): string | undefined => {
      let result: string | undefined;

      // CheckCarDetails uses table rows with label in first td, value in td.text-right
      $('table tr, table tbody tr').each((_, row) => {
        if (result) return;
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const cellLabel = $(cells[0]).text().trim();
          if (cellLabel.toLowerCase() === label.toLowerCase()) {
            const value = $(cells[1]).text().trim();
            if (value && value !== '-' && value !== 'N/A') {
              result = value;
            }
          }
        }
      });

      if (result) return result;

      // Fallback: try th/td pairs
      $('table tr').each((_, row) => {
        if (result) return;
        const th = $(row).find('th').first();
        const td = $(row).find('td').first();
        if (th.length && td.length) {
          if (th.text().trim().toLowerCase() === label.toLowerCase()) {
            const value = td.text().trim();
            if (value && value !== '-' && value !== 'N/A') {
              result = value;
            }
          }
        }
      });

      return result;
    };

    // Extract all the fields
    data.manufacturer = extractField('Make') || extractField('Manufacturer');
    data.model = extractField('Model');
    data.modelDetail = extractField('Model Variant') || extractField('Description');
    data.colour = extractField('Colour') || extractField('Color');
    data.bodyStyle = extractField('Body Style') || extractField('Body Type');
    data.fuelType = extractField('Fuel Type') || extractField('Fuel');
    data.engineSize = extractField('Engine') || extractField('Engine Size');
    data.euroStatus = extractField('Euro Status') || extractField('Euro');
    data.transmission =
      extractField('Transmission') ||
      extractField('Gearbox');

    // Performance - BHP (may be in format "123 KW / 167 BHP")
    const powerStr = extractField('Power') || extractField('BHP');
    if (powerStr) {
      const bhpMatch = powerStr.match(/(\d+)\s*BHP/i) || powerStr.match(/(\d+)/);
      if (bhpMatch) data.bhp = parseInt(bhpMatch[1], 10);
    }

    const topSpeedStr = extractField('Max Speed') || extractField('Top Speed');
    if (topSpeedStr) {
      data.topSpeed = topSpeedStr;
    }

    data.zeroToSixty =
      extractField('0 to 60 MPH') ||
      extractField('0-60') ||
      extractField('0-62');

    // Year
    const yearStr = extractField('Year of Manufacture') || extractField('Year');
    if (yearStr) {
      const yearMatch = yearStr.match(/(\d{4})/);
      if (yearMatch) data.yearOfManufacture = parseInt(yearMatch[1], 10);
    }

    // Status
    data.insuranceGroup =
      extractField('Insurance Group') || extractField('Insurance');

    // ULEZ compliance - checkcardetails shows "Yes" or "No"
    const ulezStr = extractField('ULEZ Compliant') || extractField('ULEZ');
    if (ulezStr) {
      const lower = ulezStr.toLowerCase();
      if (lower === 'yes' || lower.includes('compliant')) {
        data.ulezCompliant = true;
      } else if (lower === 'no' || lower.includes('not compliant')) {
        data.ulezCompliant = false;
      }
    }

    // Location
    data.registrationLocation =
      extractField('Registration Place') ||
      extractField('Registration Location');

    // Cache the result
    cache.set(normalized, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('Error scraping CheckCarDetails:', error);
    return null;
  }
}
