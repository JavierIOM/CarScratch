import auctionData from '../data/chrystals-auctions.json';

export interface AuctionAppearance {
  description: string;
  auctionDate: string;
  hammerPrice: number | null;
}

export interface AuctionResult {
  appearances: AuctionAppearance[];
}

// Build a lookup map from normalized registration -> appearances
const auctionMap = new Map<string, AuctionAppearance[]>();

for (const lot of auctionData.lots) {
  const normalized = lot.reg.toUpperCase().replace(/[\s-]/g, '');
  const entry: AuctionAppearance = {
    description: lot.desc,
    auctionDate: lot.date,
    hammerPrice: lot.price,
  };
  const existing = auctionMap.get(normalized);
  if (existing) {
    existing.push(entry);
  } else {
    auctionMap.set(normalized, [entry]);
  }
}

/**
 * Check if a registration has appeared in a Chrystals auction.
 * Returns auction appearances sorted by date (most recent first), or null if not found.
 */
export function checkChrystalsAuction(registration: string): AuctionResult | null {
  const normalized = registration.toUpperCase().replace(/[\s-]/g, '');
  const appearances = auctionMap.get(normalized);
  if (!appearances || appearances.length === 0) return null;

  // Sort by date descending (most recent first)
  const sorted = [...appearances].sort(
    (a, b) => new Date(b.auctionDate).getTime() - new Date(a.auctionDate).getTime()
  );

  return { appearances: sorted };
}
