/**
 * EVIDENCE COUNT CONSISTENCY & TERMINOLOGY SPECIFICATION
 *
 * Terminology:
 * - Source: An individual retrieved/source record.
 * - Primary: First-party/original source supporting the observed claim (e.g. repo commit, official changelog, company blog).
 * - Corroborating: Additional independent source supporting the same claim (e.g. news coverage, community discussion, registry).
 * - Channel: Should NOT be used as a synonym for source unless explicitly defining a delivery/medium channel.
 *
 * Standard Formats:
 * - Single source: "1 source · Primary"
 * - Multiple sources: "${total} sources · ${primary} primary · ${corroborating} corroborating"
 *
 * Never show numbers that make the user reconcile conflicting meanings.
 */

export interface EvidenceCountBreakdown {
  total: number;
  primary: number;
  corroborating: number;
  label: string;
  badgeLabel: string;
}

export const EVIDENCE_TERMINOLOGY = {
  source: "An individual retrieved/source record.",
  primary: "First-party/original source supporting the observed claim.",
  corroborating: "Additional independent source supporting the same claim.",
} as const;

/**
 * Returns structured and consistently formatted evidence count labels.
 */
export function parseEvidenceCount(
  totalSources: number,
  primaryCount: number = 1
): EvidenceCountBreakdown {
  const total = Math.max(1, totalSources || 1);
  const primary = Math.min(total, Math.max(1, primaryCount));
  const corroborating = total - primary;

  let label: string;
  let badgeLabel: string;

  if (total === 1) {
    label = "1 source · Primary";
    badgeLabel = "1 source · Primary";
  } else if (corroborating === 1) {
    label = `${total} sources · ${primary} primary · 1 corroborating`;
    badgeLabel = `${total} sources · ${primary} primary · 1 corroborating`;
  } else {
    label = `${total} sources · ${primary} primary · ${corroborating} corroborating`;
    badgeLabel = `${total} sources · ${primary} primary · ${corroborating} corroborating`;
  }

  return {
    total,
    primary,
    corroborating,
    label,
    badgeLabel,
  };
}

/**
 * Global standardized helper for displaying evidence / source counts.
 * E.g.:
 * - formatEvidenceCount(1) => "1 source · Primary"
 * - formatEvidenceCount(2) => "2 sources · 1 primary · 1 corroborating"
 * - formatEvidenceCount(3) => "3 sources · 1 primary · 2 corroborating"
 */
export function formatEvidenceCount(
  totalSources: number,
  primaryCount: number = 1
): string {
  return parseEvidenceCount(totalSources, primaryCount).label;
}

/**
 * Strict HTTP/HTTPS URL validator for evidence primary & corroborating sources.
 * Rejects undefined, null, placeholders, hash anchors, and invalid hostnames.
 */
export function isValidSourceUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === "#" ||
    trimmed.startsWith("javascript:") ||
    trimmed.length < 8
  ) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "none" ||
    lower.includes("source document unavailable") ||
    lower.includes("placeholder")
  ) {
    return false;
  }

  try {
    const fullUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(fullUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
    // Reject hostnames with invalid underscores
    if (parsed.hostname.includes("_")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize and guarantee a clean https/http URL string, or null if invalid.
 */
export function sanitizeSourceUrl(url?: string | null): string | null {
  if (!isValidSourceUrl(url)) return null;
  const trimmed = url!.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}
