/**
 * Check vehicle insurance status by scraping askMID / MIB Navigate
 * Uses Browserless.io to render the SPA and interact with the form
 * Works for both UK and IoM vehicles (askMID covers all UK-insured vehicles)
 */

import type { InsuranceStatus } from './types';

type InsuranceResult = InsuranceStatus;

// Cache insurance lookups (shorter TTL since insurance can change)
const insuranceCache = new Map<string, { data: InsuranceResult; timestamp: number }>();
const INSURANCE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function checkInsurance(registration: string): Promise<InsuranceResult | null> {
  const normalized = registration.toUpperCase().replace(/\s/g, '');

  // Check cache
  const cached = insuranceCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < INSURANCE_CACHE_TTL) {
    return cached.data;
  }

  const browserlessApiKey = import.meta.env.BROWSERLESS_API_KEY;
  if (!browserlessApiKey) {
    console.warn('BROWSERLESS_API_KEY not configured, skipping insurance check');
    return null;
  }

  try {
    // Format reg with space for the form (e.g. AB12 CDE)
    const formattedReg = normalized.length > 4
      ? normalized.slice(0, 4) + ' ' + normalized.slice(4)
      : normalized;

    const puppeteerCode = `
export default async function ({ page }) {
  try {
    const searchReg = "${formattedReg}";

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
      window.chrome = { runtime: {} };
    });

    // Navigate to the MIB check page
    await page.goto('https://enquiry.navigate.mib.org.uk/checkyourvehicle', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for the page to fully render (Next.js SPA)
    await new Promise(r => setTimeout(r, 3000));

    // Look for input fields - try various selectors
    const inputInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder,
        'aria-label': i.getAttribute('aria-label'),
        className: i.className.substring(0, 100)
      }));
    });

    // Find the registration input
    const typed = await page.evaluate((reg) => {
      // Try common selectors for registration input
      const selectors = [
        'input[name="vrm"]',
        'input[name="registration"]',
        'input[name="reg"]',
        'input[name="registrationNumber"]',
        'input[placeholder*="registration" i]',
        'input[placeholder*="reg" i]',
        'input[placeholder*="vrm" i]',
        'input[placeholder*="number plate" i]',
        'input[aria-label*="registration" i]',
        'input[aria-label*="vehicle" i]',
        'input[type="text"]',
      ];

      for (const sel of selectors) {
        const input = document.querySelector(sel);
        if (input) {
          input.value = reg;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, selector: sel, id: input.id, name: input.name };
        }
      }
      return { found: false };
    }, searchReg);

    if (!typed.found) {
      return {
        data: {
          error: 'Could not find registration input',
          inputs: JSON.stringify(inputInfo),
          html: (await page.content()).substring(0, 2000)
        },
        type: 'application/json'
      };
    }

    await new Promise(r => setTimeout(r, 500));

    // Click submit button
    const submitted = await page.evaluate(() => {
      const selectors = [
        'button[type="submit"]',
        'button:not([type="button"])',
        'input[type="submit"]',
        'button',
      ];
      for (const sel of selectors) {
        const btns = document.querySelectorAll(sel);
        for (const btn of btns) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('search') || text.includes('check') || text.includes('find') || text.includes('submit') || text.includes('go')) {
            btn.click();
            return { clicked: true, text: btn.textContent?.trim(), selector: sel };
          }
        }
      }
      // Fallback: click first submit button
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
        return { clicked: true, text: submitBtn.textContent?.trim(), selector: 'button[type="submit"]' };
      }
      return { clicked: false };
    });

    // Wait for results to load
    await new Promise(r => setTimeout(r, 5000));

    // Extract the result
    const html = await page.content();
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText || '');

    return {
      data: {
        html,
        url,
        bodyText,
        inputInfo: JSON.stringify(inputInfo),
        typed: JSON.stringify(typed),
        submitted: JSON.stringify(submitted)
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

    console.log(`[Insurance] Checking insurance for ${normalized}`);

    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}&stealth`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/javascript' },
        body: puppeteerCode,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Insurance] Browserless returned ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    let result;
    try {
      result = await response.json();
    } catch {
      console.error('[Insurance] Failed to parse Browserless response');
      return null;
    }

    const respData = result.data || result;

    if (respData.error) {
      console.error('[Insurance] Scraping error:', respData.error);
      return null;
    }

    const bodyText: string = respData.bodyText || '';
    const html: string = respData.html || '';

    console.log(`[Insurance] URL: ${respData.url}`);
    console.log(`[Insurance] Body text preview: ${bodyText.substring(0, 500)}`);

    // Parse the result from the page text
    const insuranceResult = parseInsuranceResult(bodyText, html);

    // Cache the result
    if (insuranceResult) {
      insuranceCache.set(normalized, { data: insuranceResult, timestamp: Date.now() });
    }

    return insuranceResult;
  } catch (error) {
    console.error('[Insurance] Error checking insurance:', error);
    return null;
  }
}

function parseInsuranceResult(bodyText: string, html: string): InsuranceResult | null {
  const text = bodyText.toLowerCase();
  const now = new Date().toISOString();

  // Common positive indicators
  if (
    text.includes('vehicle is insured') ||
    text.includes('is currently insured') ||
    text.includes('insurance was found') ||
    text.includes('appears on the mid') ||
    text.includes('has been found on the motor insurance database') ||
    text.includes('details have been found')
  ) {
    return {
      insured: true,
      message: 'Vehicle appears on the Motor Insurance Database',
      checkedAt: now,
    };
  }

  // Common negative indicators
  if (
    text.includes('vehicle is not insured') ||
    text.includes('not currently insured') ||
    text.includes('no insurance') ||
    text.includes('does not appear') ||
    text.includes('has not been found') ||
    text.includes('not found on the motor insurance database') ||
    text.includes('no record')
  ) {
    return {
      insured: false,
      message: 'Vehicle does not appear on the Motor Insurance Database',
      checkedAt: now,
    };
  }

  // If we got a page but couldn't determine status
  if (bodyText.length > 100) {
    console.warn('[Insurance] Could not determine insurance status from page text');
    return null;
  }

  return null;
}
