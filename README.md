# CarScratch

<p align="center">
  <img src="public/favicon.svg" alt="CarScratch Logo" width="64" height="64">
</p>

<p align="center">
  <strong>UK &amp; Isle of Man Vehicle Information Aggregator</strong>
</p>

<p align="center">
  <a href="https://carscratch.netlify.app">Live Site</a>
</p>

---

[![Netlify Status](https://api.netlify.com/api/v1/badges/3f954221-7aa6-4912-a111-f20bf830ef93/deploy-status)](https://app.netlify.com/projects/carscratch/deploys)

## Overview

CarScratch is a web application that aggregates vehicle information from multiple sources for UK and Isle of Man registered vehicles. Enter a registration number to get comprehensive data including vehicle details, MOT history, and more.

## Features

- **Vehicle Details** - Make, model, colour, engine size, fuel type, CO2 emissions
- **Tax Status** - Current tax status and expiry date
- **MOT History** - Full MOT test history with pass/fail results, advisories, and defects
- **Mileage Tracking** - Visual mileage history chart with yearly averages
- **Performance Data** - BHP, top speed, 0-60 times (where available)
- **Insurance Group** - Insurance group rating
- **ULEZ/CAZ Compliance** - London ULEZ and Clean Air Zone compliance status
- **Isle of Man Support** - Native support for Manx registrations via gov.im
- **Insurance Check Link** - Quick link to askMID to verify vehicle insurance status
- **Smart Plate Detection** - Automatically detects UK vs Isle of Man plates with visual badge indicator
- **Suggestion Box** - User feedback form for feature requests and improvements

## Tech Stack

- **Framework**: [Astro](https://astro.build) with SSR
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Hosting**: [Netlify](https://netlify.com)
- **Scraping**: [Cheerio](https://cheerio.js.org) + [Browserless.io](https://browserless.io)

## Data Sources

| Source | Data Provided | Status |
|--------|--------------|--------|
| DVLA Vehicle Enquiry API | Official UK vehicle data (make, model, colour, tax, MOT status) | Active |
| TotalCarCheck | Vehicle specs, performance, insurance group, ULEZ/CAZ, market data | Active (scraping) |
| gov.im | Isle of Man vehicle registration data | Active (via Browserless) |
| MOT History API | Official MOT test history | Planned |

## API Keys & Setup

### Browserless.io (Required for Isle of Man)

Used to render the gov.im vehicle search page which blocks standard HTTP requests.

1. Sign up at [browserless.io](https://browserless.io)
2. Free tier includes 6 hours of browser time per month
3. Get your API key from the dashboard
4. Add to Netlify environment variables as `BROWSERLESS_API_KEY`

### DVLA Vehicle Enquiry Service (Active)

Official UK government API for vehicle data.

1. Apply at [DVLA Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
2. Costs approximately 2p per lookup
3. Provides: make, model, colour, fuel type, tax status, MOT status, CO2 emissions
4. Add to Netlify environment variables as `DVLA_API_KEY`

### MOT History API (Planned)

Official UK government API for MOT test history.

1. Register at [MOT History API](https://documentation.history.mot.api.gov.uk/mot-history-api/register)
2. Free to use
3. Requires OAuth 2.0 authentication via Microsoft Entra ID
4. Provides: full MOT test history, mileage readings, advisories, failures

## Environment Variables

```env
# Required for Isle of Man lookups
BROWSERLESS_API_KEY=your_browserless_api_key

# Planned - Official UK APIs
DVLA_API_KEY=your_dvla_api_key
MOT_CLIENT_ID=your_mot_client_id
MOT_CLIENT_SECRET=your_mot_client_secret
MOT_API_KEY=your_mot_api_key
```

Set these in your Netlify dashboard under **Site Settings > Environment Variables**.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Test Registrations

For testing with mock data:

| Registration | Vehicle |
|--------------|---------|
| AB12 CDE | VW Golf - has MOT failures |
| BD19 XYZ | BMW 3 Series - clean record |
| YH65 ABC | Ford Focus - SORN, failed MOT |
| WR71 DEF | Tesla Model 3 - electric |
| MK08 GHI | Vauxhall Astra - dangerous defect |

For real UK vehicles, enter any valid UK registration number.

For Isle of Man vehicles, enter a Manx plate (e.g., PMN 147 E, MAN 123).

## Supported Registration Formats

### UK
- Standard format: `AB12 CDE`
- Older formats: `A123 ABC`, `ABC 123A`

### Isle of Man
- Classic: `PMN 147 E`, `MAN 123`
- Letter suffixes: `AMN`, `BMN`, `CMN`, etc.
- Modern: `1-MN-00`

## UI Features

- **Smart Plate Badge** - Blue "GB" badge for UK plates, red "M" badge for Isle of Man plates
- **Progress Indicator** - Animated progress bar during vehicle lookups
- **Custom 404 Page** - Friendly error page with auto-redirect to home
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Motorcycle Support** - Engine sizes under 1000cc display as cc (e.g., "660cc") rather than litres

## SEO

- Full Open Graph and Twitter Card meta tags for social sharing
- JSON-LD structured data (WebSite, Organization, Vehicle schemas)
- Dynamic sitemap at `/sitemap.xml`
- robots.txt with crawler directives
- Canonical URLs on all pages
- PWA manifest for app-like experience

## License

ISC

## Author

Built by [JavierIOM](https://github.com/JavierIOM)

---

**Current Version:** v1.2.0
