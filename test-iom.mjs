// Quick test of IoM scraper logic with timing
const GOV_IM_URL = 'https://services.gov.im/service/VehicleSearch';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractCookies(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  const parts = raw.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
  return parts.map(sc => sc.split(';')[0].trim()).filter(Boolean);
}

async function fetchWithCookies(url, maxRedirects = 4) {
  const cookieJar = new Map();

  const addCookies = (res) => {
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
    let res;
    const start = Date.now();
    try {
      res = await fetch(currentUrl, { headers: headers(), redirect: 'manual', signal: controller.signal });
    } catch (err) {
      console.error(`Fetch failed at hop ${i}: ${err}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
    addCookies(res);

    console.log(`${i}: ${res.status} ${currentUrl} (${Date.now() - start}ms, cookies: ${cookieJar.size})`);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      currentUrl = location.startsWith('http') ? location : `https://services.gov.im${location}`;
      await res.text().catch(() => {});
      continue;
    }

    const html = await res.text();
    return { html, cookies: [...cookieJar.values()].join('; ') };
  }

  console.error('Too many redirects');
  return null;
}

async function getSession() {
  const result = await fetchWithCookies(GOV_IM_URL);
  if (!result) return null;

  const tokenMatch = result.html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (!tokenMatch) {
    console.error('No CSRF token found');
    return null;
  }

  return { cookies: result.cookies, csrfToken: tokenMatch[1] };
}

async function scrapeIOM(registration) {
  const totalStart = Date.now();
  const formattedReg = registration.toUpperCase().replace(/[\s-]+/g, '');
  console.log(`Looking up ${formattedReg}...`);

  const session = await getSession();
  if (!session) {
    console.error('Session failed');
    return null;
  }
  console.log(`Got session (${Date.now() - totalStart}ms total so far)`);

  const body = new URLSearchParams({
    RegMarkNo: formattedReg,
    __RequestVerificationToken: session.csrfToken,
  });

  const postStart = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let searchRes;
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
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`POST failed: ${err}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  console.log(`POST returned ${searchRes.status} (${Date.now() - postStart}ms)`);
  if (!searchRes.ok) return null;

  const html = await searchRes.text();
  console.log(`HTML length: ${html.length}`);
  console.log(`Total time: ${Date.now() - totalStart}ms`);

  if (html.includes('No vehicle found') || html.includes('was rejected')) {
    console.log('Vehicle not found');
    return null;
  }

  // Parse with regex
  const findValue = (label) => {
    const regex = new RegExp(`<th[^>]*>[^<]*${label}[^<]*</th>\\s*<td[^>]*>([^<]+)</td>`, 'i');
    const match = html.match(regex);
    return match ? match[1].trim() : undefined;
  };

  const result = {
    registrationNumber: registration,
    make: findValue('Make'),
    model: findValue('Model'),
    modelVariant: findValue('Model Variant'),
    colour: findValue('Colour'),
    fuelType: findValue('Fuel'),
    taxStatus: findValue('Status of Vehicle Licence'),
    previousUKRegistration: findValue('Previous Registration Number'),
  };

  console.log('\nResult:', JSON.stringify(result, null, 2));
  return result;
}

// Test with a known Manx plate
scrapeIOM('PMN147E').catch(console.error);
