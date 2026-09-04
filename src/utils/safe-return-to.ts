/**
 * Same-site post-login destination.
 *
 * Only a root-relative path is accepted. Protocol-relative URLs, backslashes,
 * credentials, and other-origin parses fall back to the caller default.
 */
const FALLBACK = "/leaderboard";

export function isSafeReturnTo(raw: string | null | undefined): raw is string {
  if (!raw || raw[0] !== "/") return false;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return false;
  if (raw.includes("\\") || raw.includes("://")) return false;
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) return false;
  try {
    const url = new URL(raw, "https://chenrunsen.invalid");
    return (
      url.origin === "https://chenrunsen.invalid" && url.pathname.startsWith("/")
    );
  } catch {
    return false;
  }
}

export function resolveReturnTo(
  fallback: string,
  search: string = typeof window === "undefined" ? "" : window.location.search,
): string {
  const safeFallback = isSafeReturnTo(fallback) ? fallback : FALLBACK;
  const raw = new URLSearchParams(search).get("returnTo");
  return isSafeReturnTo(raw) ? raw : safeFallback;
}
