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

    // Puppeteer script that runs inside Browserless
    // Uses page.type() for React compatibility and longer waits for SPA rendering
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

    // Wait longer for the Next.js SPA to fully hydrate
    await new Promise(r => setTimeout(r, 5000));

    // Dismiss any cookie consent banners first
    await page.evaluate(() => {
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[data-testid*="accept"]',
        'a[id*="accept"]',
      ];
      for (const sel of cookieSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          break;
        }
      }
      // Also try clicking buttons with accept-like text
      const buttons = document.querySelectorAll('button, a');
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('accept') || text.includes('agree') || text.includes('got it') || text.includes('ok')) {
          btn.click();
          break;
        }
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Gather diagnostic info about all interactive elements
    const pageInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));
      const forms = Array.from(document.querySelectorAll('form'));
      return {
        url: window.location.href,
        title: document.title,
        inputs: inputs.map(i => ({
          tag: i.tagName,
          type: i.getAttribute('type'),
          name: i.getAttribute('name'),
          id: i.id,
          placeholder: i.getAttribute('placeholder'),
          ariaLabel: i.getAttribute('aria-label'),
          className: (i.className || '').substring(0, 80),
          dataTestId: i.getAttribute('data-testid'),
        })),
        buttons: buttons.map(b => ({
          tag: b.tagName,
          type: b.getAttribute('type'),
          text: (b.textContent || '').trim().substring(0, 50),
          id: b.id,
          className: (b.className || '').substring(0, 80),
          dataTestId: b.getAttribute('data-testid'),
        })),
        formCount: forms.length,
        bodyTextPreview: (document.body?.innerText || '').substring(0, 1000),
      };
    });

    // Try to find the registration input using multiple strategies
    const inputSelectors = [
      'input[name="vrm"]',
      'input[name="registration"]',
      'input[name="reg"]',
      'input[name="registrationNumber"]',
      'input[name="vehicleRegistrationMark"]',
      'input[id*="vrm" i]',
      'input[id*="reg" i]',
      'input[id*="vehicle" i]',
      'input[data-testid*="vrm" i]',
      'input[data-testid*="reg" i]',
      'input[data-testid*="vehicle" i]',
      'input[placeholder*="registration" i]',
      'input[placeholder*="reg" i]',
      'input[placeholder*="vrm" i]',
      'input[placeholder*="number plate" i]',
      'input[placeholder*="enter" i]',
      'input[aria-label*="registration" i]',
      'input[aria-label*="vehicle" i]',
      'input[aria-label*="vrm" i]',
      'input[type="text"]',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
    ];

    // Use page.type() instead of setting .value for React compatibility
    let typed = false;
    let usedSelector = '';

    for (const sel of inputSelectors) {
      try {
        const exists = await page.$(sel);
        if (exists) {
          // Clear any existing value first
          await page.click(sel, { clickCount: 3 });
          await page.type(sel, searchReg, { delay: 50 });
          typed = true;
          usedSelector = sel;
          break;
        }
      } catch (e) {
        // selector didn't match, try next
      }
    }

    if (!typed) {
      return {
        data: {
          error: 'Could not find registration input',
          pageInfo: JSON.stringify(pageInfo),
        },
        type: 'application/json'
      };
    }

    await new Promise(r => setTimeout(r, 500));

    // Click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
    ];

    let submitted = false;
    let submitInfo = '';

    // First try explicit submit buttons
    for (const sel of submitSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          submitted = true;
          submitInfo = sel;
          break;
        }
      } catch (e) {}
    }

    // Fallback: find buttons by text content
    if (!submitted) {
      submitted = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, a[role="button"]');
        const keywords = ['search', 'check', 'find', 'submit', 'go', 'look up', 'lookup'];
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase().trim();
          if (keywords.some(kw => text.includes(kw))) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      submitInfo = 'text-match';
    }

    // Fallback: press Enter in the input field
    if (!submitted) {
      try {
        await page.keyboard.press('Enter');
        submitted = true;
        submitInfo = 'enter-key';
      } catch (e) {}
    }

    // Wait for results to load
    await new Promise(r => setTimeout(r, 8000));

    // Extract the result
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText || '');

    return {
      data: {
        bodyText,
        url: finalUrl,
        usedSelector,
        submitInfo,
        inputCount: pageInfo.inputs.length,
        pageInfo: JSON.stringify(pageInfo),
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
    } catch (_e) {
      console.error('[Insurance] Failed to parse Browserless response');
      return null;
    }

    const respData = result.data || result;

    // Log diagnostic info
    if (respData.pageInfo) {
      console.log(`[Insurance] Page info: ${respData.pageInfo.substring(0, 500)}`);
    }
    if (respData.usedSelector) {
      console.log(`[Insurance] Used selector: ${respData.usedSelector}`);
    }
    if (respData.submitInfo) {
      console.log(`[Insurance] Submit method: ${respData.submitInfo}`);
    }

    if (respData.error) {
      console.error('[Insurance] Scraping error:', respData.error);
      // Log page info so we can debug selector issues
      if (respData.pageInfo) {
        console.error('[Insurance] Page structure:', respData.pageInfo.substring(0, 1000));
      }
      return null;
    }

    const bodyText: string = respData.bodyText || '';

    console.log(`[Insurance] URL: ${respData.url}`);
    console.log(`[Insurance] Body text preview: ${bodyText.substring(0, 500)}`);

    // Parse the result from the page text
    const insuranceResult = parseInsuranceResult(bodyText);

    // Cache the result
    if (insuranceResult) {
      insuranceCache.set(normalized, { data: insuranceResult, timestamp: Date.now() });
    } else {
      console.warn(`[Insurance] Could not parse result. Full body text: ${bodyText.substring(0, 2000)}`);
    }

    return insuranceResult;
  } catch (error) {
    console.error('[Insurance] Error checking insurance:', error);
    return null;
  }
}

function parseInsuranceResult(bodyText: string): InsuranceResult | null {
  const text = bodyText.toLowerCase();
  const now = new Date().toISOString();

  // Positive indicators
  if (
    text.includes('vehicle is insured') ||
    text.includes('is currently insured') ||
    text.includes('insurance was found') ||
    text.includes('appears on the mid') ||
    text.includes('has been found on the motor insurance database') ||
    text.includes('details have been found') ||
    text.includes('this vehicle is insured') ||
    text.includes('a policy has been found') ||
    text.includes('record found') ||
    text.includes('is insured')
  ) {
    return {
      insured: true,
      message: 'Vehicle appears on the Motor Insurance Database',
      checkedAt: now,
    };
  }

  // Negative indicators
  if (
    text.includes('vehicle is not insured') ||
    text.includes('not currently insured') ||
    text.includes('no insurance') ||
    text.includes('does not appear') ||
    text.includes('has not been found') ||
    text.includes('not found on the motor insurance database') ||
    text.includes('no record') ||
    text.includes('is not insured') ||
    text.includes('no policy found') ||
    text.includes('not insured')
  ) {
    return {
      insured: false,
      message: 'Vehicle does not appear on the Motor Insurance Database',
      checkedAt: now,
    };
  }

  return null;
}
