# CarScratch

<p align="center">
  <img src="public/favicon.svg" alt="CarScratch Logo" width="64" height="64">
</p>

<p align="center">
  <strong>UK &amp; Isle of Man Vehicle Information Aggregator</strong>
</p>

<p align="center">
  <a href="https://carscratch.uk">Live Site</a>
</p>

---

[![Netlify Status](https://api.netlify.com/api/v1/badges/3f954221-7aa6-4912-a111-f20bf830ef93/deploy-status)](https://app.netlify.com/projects/carscratch/deploys)

## Overview

CarScratch is a web application that aggregates vehicle information from multiple sources for UK and Isle of Man registered vehicles. Enter a registration number to get comprehensive data including vehicle details, MOT history, auction history, and more.

## Features

- **Vehicle Details** - Make, model, colour, engine size, fuel type, CO2 emissions
- **Tax Status** - Current tax status and expiry date
- **MOT History** - Full MOT test history with pass/fail results, advisories, and defects
- **Mileage Tracking** - Visual mileage history chart with yearly averages (deduplicated for accuracy)
- **Performance Data** - BHP, top speed, 0-60 times (where available)
- **Insurance Group** - Insurance group rating
- **ULEZ/CAZ Compliance** - London ULEZ and Clean Air Zone compliance status
- **Auction History** - Shows if a vehicle has appeared in IOM auctions with hammer prices
- **Isle of Man Support** - Native support for Manx registrations via gov.im
- **Insurance Check Link** - Quick link to askMID to verify vehicle insurance status
- **Smart Plate Detection** - Automatically detects UK vs Isle of Man plates with visual badge indicator
- **Smart Plate Formatting** - Correctly formats all UK plate types (current, prefix, suffix, dateless)
- **Suggestion Box** - User feedback form for feature requests and improvements

## Tech Stack

- **Framework**: [Astro](https://astro.build) with SSR
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Hosting**: [Netlify](https://netlify.com)
- **Scraping**: [Cheerio](https://cheerio.js.org) for HTML parsing

## Data Sources

| Source | Data Provided | Status |
|--------|--------------|--------|
| DVLA Vehicle Enquiry API | Official UK vehicle data (make, model, colour, tax, MOT status) | Active |
| MOT History API | Official MOT test history, mileage readings, defects | Active |
| TotalCarCheck | Vehicle specs, performance, insurance group, ULEZ/CAZ, market data | Active (scraping) |
| gov.im | Isle of Man vehicle registration data | Active (direct HTTP) |
| IOM Auction Site | IoM auction history and hammer prices | Active (manual updates) |

## API Keys & Setup

### DVLA Vehicle Enquiry Service

Official UK government API for vehicle data.

1. Apply at [DVLA Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
2. Costs approximately 2p per lookup
3. Provides: make, model, colour, fuel type, tax status, MOT status, CO2 emissions
4. Add to Netlify environment variables as `DVLA_API_KEY`

### MOT History API

Official UK government API for MOT test history.

1. Register at [MOT History API](https://documentation.history.mot.api.gov.uk/mot-history-api/register)
2. Free to use
3. Requires OAuth 2.0 client credentials flow via Microsoft Entra ID
4. Provides: full MOT test history, mileage readings, advisories, failures, recall status
5. Add credentials to environment variables as `MOT_CLIENT_ID`, `MOT_CLIENT_SECRET`, `MOT_API_KEY`, `MOT_TENANT_ID`

## Environment Variables

```env
# Official UK APIs
DVLA_API_KEY=your_dvla_api_key
MOT_CLIENT_ID=your_mot_client_id
MOT_CLIENT_SECRET=your_mot_client_secret
MOT_API_KEY=your_mot_api_key
MOT_TENANT_ID=your_mot_tenant_id
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

For Isle of Man vehicles, enter a Manx plate (e.g., PMN 147 E, MAN 123, 79NMN).

## Supported Registration Formats

### UK
- Current format: `AB12 CDE`
- Prefix format: `A12 XYZ`, `A123 BCD`
- Suffix format: `ABC 123D`
- Dateless: `ABC 123`, `123 ABC`, `A 1`

### Isle of Man
- Classic: `PMN 147 E`, `MAN 123`
- Letter suffixes: `AMN`, `BMN`, `CMN`, etc.
- Modern: `1-MN-00`
- Numbers first: `79NMN`

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

## Auction Data

The site includes auction history from the [IOM Auction Site](https://www.chrystalsauctions.im) (Isle of Man). This data is manually updated and shows:

- Auction date
- Vehicle description from the lot
- Hammer price (or "Didn't make reserve" if unsold)

The raw auction data is available at `/data/chrystals-auctions.json`.

## Privacy & Data Protection

CarScratch does not store vehicle lookup data or track individual searches. All queries are processed in real-time and results are not cached beyond the current session. We use no analytics or tracking cookies.

This service does not breach GDPR or any data protection regulations. All vehicle data displayed is already publicly available through official government services and public records. Vehicle registration data is not considered personal data as it relates to the vehicle, not to any individual. We simply aggregate publicly accessible information into a convenient format - no private or protected data is collected, processed, or stored.

## License

ISC

## Author

Built by [JavierIOM](https://github.com/JavierIOM)

---

**Current Version:** v1.4.1
