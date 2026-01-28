import type { APIRoute } from 'astro';

const SITE_URL = 'https://carscratch.netlify.app';

const pages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/suggestions', priority: '0.5', changefreq: 'monthly' },
];

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
