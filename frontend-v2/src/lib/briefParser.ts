/**
 * Parser for PrismIQ Structured Markdown Briefs
 * Extracts Top 3 Decisions, Executive Summary Rollup, and Tiered Findings.
 */

export interface TopDecision {
  number: number;
  company: string;
  headline: string;
  impact: string;
}

export interface RollupRow {
  theme: string;
  competitors: string;
  eventsCount: string;
  patternDetected: string;
}

export interface TierFindingItem {
  title: string;
  url?: string;
  company: string;
  whyItMatters: string;
  fact?: string;
  sourceType?: string;
}

export interface ParsedBrief {
  topDecisions: TopDecision[];
  rollupRows: RollupRow[];
  mustKnow: TierFindingItem[];
  shouldKnow: TierFindingItem[];
  otherActivity: TierFindingItem[];
  partialFailure?: {
    sourceName: string;
    details: string;
  };
}

export function parseBriefMarkdown(content: string): ParsedBrief {
  const result: ParsedBrief = {
    topDecisions: [],
    rollupRows: [],
    mustKnow: [],
    shouldKnow: [],
    otherActivity: [],
  };

  if (!content) return result;

  // 1. Check for partial source failures (Decision Point 1 / Part 9.4)
  if (content.toLowerCase().includes("unavailable due to rate limits") || content.toLowerCase().includes("degraded")) {
    result.partialFailure = {
      sourceName: "News & Analysis Upstream",
      details: "One or more secondary sources encountered temporary rate limits during this collection cycle. Findings were consolidated from verified primary signals.",
    };
  }

  // 2. Extract Top 3 Decisions
  // Pattern: 1. **Company** (Headline): Impact text (allowing nested parentheses in headline up to "):")
  const decisionsRegex = /(?:^|\n)(\d+)\.\s+\*\*([^*]+)\*\*\s*\((.*?)\):\s*([^\n]+(?:\n(?!\d+\.|\n##)[^\n]+)*)/g;
  let match;
  while ((match = decisionsRegex.exec(content)) !== null) {
    result.topDecisions.push({
      number: parseInt(match[1], 10),
      company: match[2].trim(),
      headline: match[3].trim(),
      impact: match[4].replace(/\s+/g, " ").trim(),
    });
  }

  // 3. Extract Executive Summary Table
  const tableLines = content.split("\n").filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (tableLines.length >= 3) {
    // skip header (0) and separator (1)
    for (let i = 2; i < tableLines.length; i++) {
      const cols = tableLines[i]
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c !== "");
      if (cols.length >= 4) {
        result.rollupRows.push({
          theme: cols[0].replace(/\*\*/g, ""),
          competitors: cols[1],
          eventsCount: cols[2],
          patternDetected: cols[3].replace(/\*\*/g, ""),
        });
      }
    }
  }

  // 4. Extract Tiered Findings
  // Findings occur under #### Must-Know, #### Should-Know, #### Other Activity
  const lines = content.split("\n");
  let currentTier: "must" | "should" | "other" | null = null;
  let currentCompany = "General";
  let currentItem: Partial<TierFindingItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect company header: ### Vercel or #### Cloudflare
    if (line.startsWith("### ") && !line.includes("Theme:")) {
      currentCompany = line.replace("###", "").trim();
      continue;
    }
    if (line.startsWith("#### ") && (line.includes("(") && line.includes("items)"))) {
      currentCompany = line.replace("####", "").split("(")[0].trim();
      continue;
    }

    // Detect tier headers
    if (line.toLowerCase().includes("must-know") || line.toLowerCase().includes("#### must-know")) {
      currentTier = "must";
      continue;
    }
    if (line.toLowerCase().includes("should-know") || line.toLowerCase().includes("#### should-know")) {
      currentTier = "should";
      continue;
    }
    if (
      line.toLowerCase().includes("other activity") ||
      line.toLowerCase().includes("nice-to-know") ||
      line.toLowerCase().includes("routine operational")
    ) {
      currentTier = "other";
      continue;
    }

    // New item starts with - **[Title](url)** or - **Title**
    if (line.startsWith("- **")) {
      if (currentItem && currentItem.title && currentTier) {
        saveItem(currentTier, currentItem as TierFindingItem, result);
      }

      currentItem = {
        company: currentCompany,
        whyItMatters: "",
      };

      const linkMatch = line.match(/- \*\*\[(.*?)\]\((.*?)\)\*\*/);
      if (linkMatch) {
        currentItem.title = linkMatch[1];
        currentItem.url = linkMatch[2];
      } else {
        const titleMatch = line.match(/- \*\*(.*?)\*\*/);
        if (titleMatch) {
          currentItem.title = titleMatch[1];
        } else {
          currentItem.title = line.replace(/^[-\s*]+/, "");
        }
      }
      continue;
    }

    // Sub-bullets for Why it matters or Fact
    if (currentItem) {
      if (line.toLowerCase().includes("why it matters:") || line.toLowerCase().includes("- why it matters:")) {
        currentItem.whyItMatters = line.replace(/^[-\s*]*why it matters:?/i, "").trim();
      } else if (line.toLowerCase().includes("fact:") || line.toLowerCase().includes("- fact:")) {
        currentItem.fact = line.replace(/^[-\s*]*fact:?/i, "").trim();
      } else if (line.startsWith("- ") && !currentItem.whyItMatters) {
        currentItem.whyItMatters = line.replace(/^-\s*/, "").trim();
      }
    }
  }

  if (currentItem && currentItem.title && currentTier) {
    saveItem(currentTier, currentItem as TierFindingItem, result);
  }

  return result;
}

function saveItem(tier: "must" | "should" | "other", item: TierFindingItem, result: ParsedBrief) {
  if (tier === "must") result.mustKnow.push(item);
  else if (tier === "should") result.shouldKnow.push(item);
  else result.otherActivity.push(item);
}
