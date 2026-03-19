/**
 * Centralised API base URL.
 * - Local dev  → http://localhost:8082
 * - Production → https://api.atlasforgehub.com (crypto-bot runs on same VPS)
 */
export const API_BASE = (() => {
  if (typeof window === "undefined") return "http://localhost:8082";
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isLocal ? "http://localhost:8082" : "https://api.atlasforgehub.com";
})();
