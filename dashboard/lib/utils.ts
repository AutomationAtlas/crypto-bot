/** Returns a human-readable relative time string (e.g. "2m ago", "just now"). */
export function timeAgo(isoTimestamp: string): string {
  const diffMs  = Date.now() - new Date(isoTimestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5)   return "just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH   = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

/**
 * Format a crypto price with appropriate decimal places.
 * XRP uses 4dp; BTC/ETH/SOL/BNB use 2dp.
 */
export function fmtCryptoPrice(price: number, symbol: string): string {
  return price.toFixed(symbol.startsWith("XRP") ? 4 : 2);
}

/** Format a USD value with 2dp and a $ prefix. */
export function fmtUsd(value: number): string {
  const abs  = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
