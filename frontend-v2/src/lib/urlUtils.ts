/**
 * PrismIQ Source Document URL Validator & Normalizer
 *
 * Requirements:
 * 1. Check that the URL exists.
 * 2. Validate URL format.
 * 3. Allow only HTTP and HTTPS URLs.
 * 4. Check for missing or invalid source references.
 * 5. Do not replace missing URLs with generic or unrelated links.
 * 6. If a URL is unavailable, display: "Source document unavailable."
 * 7. Do not create fake links.
 */

export function isValidSourceUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes(" ") || trimmed.length < 8) return false;

  // Strict HTTP/HTTPS requirement
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  // Reject placeholder patterns that lead to 404 or dead domains
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("/updates/1") ||
    lower.includes("/updates/2") ||
    lower.includes("/updates/3") ||
    lower.includes("/updates/4") ||
    lower.includes("/updates/5") ||
    lower.includes("example.com") ||
    lower.includes("placeholder") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("awsamplify.com") ||
    lower.includes("cloudflarepages.com")
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeSourceUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  let trimmed = url.trim();
  if (!trimmed || trimmed.includes(" ") || trimmed.length < 4) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-.]+/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    } else {
      return null;
    }
  }

  return isValidSourceUrl(trimmed) ? trimmed : null;
}
