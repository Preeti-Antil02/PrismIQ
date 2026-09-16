/**
 * Timestamp utilities for Obsidian Intelligence.
 * Primary display should be human relative time (e.g. "2h ago", "Yesterday").
 * Full formatted time is available on hover (e.g. "Sep 13, 2026 · 01:49 UTC").
 */

export interface FormattedTime {
  relative: string;
  full: string;
}

export function formatRelativeTime(rawDate?: string | number | Date | null): FormattedTime {
  if (!rawDate) {
    return { relative: "Recently", full: "Recent cycle" };
  }

  // If already a clean short string like "Sep 9, 2026" or "2h ago", handle gracefully
  if (typeof rawDate === "string") {
    // Check if it's already a relative format or clean human date without ISO clutter
    if (/^\d+[hmwd]\s+ago$/i.test(rawDate.trim()) || /^(just now|yesterday)$/i.test(rawDate.trim())) {
      return { relative: rawDate, full: rawDate };
    }
  }

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    return {
      relative: String(rawDate).slice(0, 16),
      full: String(rawDate),
    };
  }

  // Full timestamp for hover/inspection: "Sep 13, 2026 · 01:49 UTC"
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const year = d.getUTCFullYear();
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  const full = `${month} ${day}, ${year} · ${hours}:${mins} UTC`;

  // Relative time calculation
  // Local reference time for current mock/workspace: 2026-09-13
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  // If timestamp is in the future or within a couple minutes
  if (diffSec < 120 && diffSec >= -300) {
    return { relative: "Just now", full };
  }
  if (diffMin < 60 && diffMin >= 0) {
    return { relative: `${diffMin}m ago`, full };
  }
  if (diffHours < 24 && diffHours >= 0) {
    return { relative: `${diffHours}h ago`, full };
  }
  if (diffDays === 1) {
    return { relative: "Yesterday", full };
  }
  if (diffDays > 1 && diffDays < 14) {
    return { relative: `${diffDays}d ago`, full };
  }

  // Older dates: "Sep 10" or "Sep 10, 2026"
  const relative = year === now.getUTCFullYear() ? `${month} ${day}` : `${month} ${day}, ${year}`;
  return { relative, full };
}
