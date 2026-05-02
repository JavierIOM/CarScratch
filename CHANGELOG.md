# Changelog

## [2.6.2] — 2026-05-02

### Added
- "Last updated" timestamp in footer — pulls from auction data lastUpdated field, displayed in BST

## [2.6.1] — 2026-05-02

### Added
- May 2 2026 auction results — 59 sold, 33 no sale
- TMN522H Honda CR-V added (was listed as REG TBC pre-auction)

## [2.6.0] — 2026-05-01

### Added
- May 2 2026 auction — 91 vehicle lots scraped pre-auction (prices pending)
- Auction URL added for 2026-05-02

## [2.5.0] — 2026-03-30

### Added
- Facebook cover photo (820x312px PNG) at `public/facebook-cover.png` — dark terminal aesthetic with dot-grid texture, diagonal stripe accent, and stylised amber registration plate element
- Generation script at `scripts/gen-facebook-cover.cjs` using `canvas`

## [2.4.0] — 2026-03-31

### Added
- Buyer's fee estimates on auction lot cards — shows hammer price plus estimated total (flat reg and free reg tiers, inc VAT)
- Nov 29 2025 auction pages 2 & 3 — 69 vehicles total with hammer prices
- Feb 28 2026 auction results — 56 sold, 22 no sale

### Changed
- "Also listed" replaces "Previously listed" — correct for appearances in future auctions too
- All auction house name references removed from UI; neutral "Isle of Man Vehicle Auction(s)" used throughout

## [2.3.0] — 2026-03-28

### Added
- Auction archive page at `/auctions` listing all recorded sales with lot counts, sold counts, and total value
- "Auctions" link in the site header navigation
- Auctions banner on the homepage linking to the archive
- Per-date auction URLs stored in `chrystals-auctions.json` under `auctionUrls` map
- Mar 28 2026 auction results — 69 sold, 23 no sale

### Changed
- Auction day now treated as past so same-day results display correctly

### Fixed
- `2953-MAN` plate now correctly detected as Manx and routed through IOM lookup
- Previously-listed red border no longer overridden by tax/MOT JS border update
- "View on Easy Live Auction" link only shown for dates with a stored URL
- Previously-listed section made more visually distinct (red border box, red text)

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
