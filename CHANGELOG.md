# Changelog

## [2.2.0] — 2026-03-27

### Added
- Auction listing page at `/auction/[date]` showing all vehicle lots for a given sale
- Mar 28 2026 auction data — 91 vehicles across 3 pages scraped from Easy Live Auction
- JSON API endpoint `/api/vehicle/[reg]` returning slim vehicle status (tax, MOT, mileage)
- Lazy IntersectionObserver loading of tax/MOT status badges on the auction listing page
- Card border colour tinting based on vehicle tax/MOT status (green = good, red = SORN/expired)

### Changed
- `lastUpdated` in auction data updated to 2026-03-28

## [2.1.2] — 2026-03-05

### Fixed
- Restored ScraperAPI as the primary proxy; scrape.do moved back to fallback
- Proxy selection order corrected after scrape.do swap caused failures

## [2.1.1] — 2026-02-20

### Fixed
- OG image URL cache-busted with `?v=2` to force Facebook re-fetch
- Added `fb:app_id`, `og:image:type`, `og:image:secure_url`, `og:image:alt` meta tags
- Corrected `robots.txt` sitemap URL to use `carscratch.uk` instead of Netlify subdomain

## [2.1.0] — 2026-02-14

### Added
- Client-side PDF export using jsPDF — vehicle data embedded in page as JSON
- Isle of Man Vehicle Duty calculator with three-tier logic (veteran / pre-2010 / post-2010)
- Human-readable vehicle category and drive type labels in ExtrasCard
- Open Graph image (1200×630) generated from SVG via Sharp; full OG + Facebook meta tags
- Favicons generated in all standard sizes from `public/favicon.svg`

### Fixed
- Wheel Plan filter — only stored when value contains "axle" to prevent scraper false-positives
- IoM duty calculation corrected for pre-April 2010 vehicles
- Engine capacity fallback and veteran rate (£28 flat) added to duty calculator
