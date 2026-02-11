import type { APIRoute } from 'astro';
import { scrapeTotalCarCheck } from '../../lib/scraper';

export const GET: APIRoute = async ({ url }) => {
  const reg = url.searchParams.get('reg') || 'AB12CDE';

  try {
    const result = await scrapeTotalCarCheck(reg);

    return new Response(JSON.stringify({
      registration: reg,
      scraperResult: result,
      timestamp: new Date().toISOString(),
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      registration: reg,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
