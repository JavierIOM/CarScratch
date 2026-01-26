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

    const url = `https://totalcarcheck.co.uk/FreeCheck?regno=${encodeURIComponent(normalized)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error(`TotalCarCheck returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check if we got a valid result page
    if (
      html.includes('No vehicle found') ||
      html.includes('Please enter a valid')
    ) {
      return null;
    }

    const data: ScrapedVehicleData = {
      scrapedFrom: 'totalcarcheck.co.uk',
      scrapedAt: new Date().toISOString(),
    };

    // Helper to extract text after a label
    const extractField = (label: string): string | undefined => {
      // Try finding in various formats
      const patterns = [
        `h4:contains("${label}")`,
        `strong:contains("${label}")`,
        `td:contains("${label}")`,
        `th:contains("${label}")`,
      ];

      for (const pattern of patterns) {
        const element = $(pattern).first();
        if (element.length) {
          // Get next sibling or parent's next element
          const next = element.next();
          if (next.length && next.text().trim()) {
            return next.text().trim();
          }
          // Try getting text from parent
          const parent = element.parent();
          const text = parent.text().replace(label, '').trim();
          if (text) return text;
        }
      }

      // Try regex on full HTML for common patterns
      const regex = new RegExp(`${label}[:\\s]*([^<]+)`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }

      return undefined;
    };

    // Extract all the fields
    data.manufacturer = extractField('Manufacturer') || extractField('Make');
    data.model = extractField('Model');
    data.colour = extractField('Colour') || extractField('Color');
    data.bodyStyle = extractField('Body Style') || extractField('Body Type');
    data.fuelType = extractField('Fuel Type') || extractField('Fuel');
    data.engineSize = extractField('Engine Size') || extractField('Engine');
    data.euroStatus = extractField('Euro Status') || extractField('Euro');

    // Performance
    const bhpStr = extractField('BHP') || extractField('Power');
    if (bhpStr) {
      const bhpMatch = bhpStr.match(/(\d+)/);
      if (bhpMatch) data.bhp = parseInt(bhpMatch[1], 10);
    }

    data.topSpeed = extractField('Top Speed');
    data.zeroToSixty =
      extractField('0-60') ||
      extractField('0-62') ||
      extractField('Acceleration');

    // Year
    const yearStr = extractField('Year of Manufacture') || extractField('Year');
    if (yearStr) {
      const yearMatch = yearStr.match(/(\d{4})/);
      if (yearMatch) data.yearOfManufacture = parseInt(yearMatch[1], 10);
    }

    // Status
    data.insuranceGroup =
      extractField('Insurance Group') || extractField('Insurance');
    data.motStatus = extractField('MOT Status') || extractField('MOT');
    data.taxStatus =
      extractField('Road Tax Status') ||
      extractField('Tax Status') ||
      extractField('Tax');

    // ULEZ/CAZ
    const ulezStr = extractField('ULEZ') || extractField('London ULEZ');
    data.ulezCompliant =
      ulezStr?.toLowerCase().includes('yes') ||
      ulezStr?.toLowerCase().includes('compliant');

    const cazStr = extractField('CAZ') || extractField('Clean Air Zone');
    data.cazCompliant =
      cazStr?.toLowerCase().includes('yes') ||
      cazStr?.toLowerCase().includes('compliant');

    // Market data
    data.previousPrice =
      extractField('Previously Seen Price') ||
      extractField('Price') ||
      extractField('Advertised Price');
    data.previousMileage =
      extractField('Previously Seen Mileage') ||
      extractField('Advertised Mileage');

    // Location
    data.registrationLocation =
      extractField('Registration Location') ||
      extractField('Registered Location');

    // Cache the result
    cache.set(normalized, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('Error scraping TotalCarCheck:', error);
    return null;
  }
}
