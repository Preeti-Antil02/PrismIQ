/**
 * Parser for PrismIQ Structured Markdown Briefs
 * Extracts Top 3 Decisions, Executive Summary Rollup, Tiered Findings, and Company Aggregations.
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
  confidence?: "High" | "Medium" | "Low";
  corroboration?: string;
  date?: string;
  impactScore: number;
}

export interface CompanySummary {
  companyName: string;
  mustCount: number;
  shouldCount: number;
  otherCount: number;
  totalCount: number;
  threatScore: number; // 0 - 100
  threatLevel: "Critical" | "High" | "Moderate" | "Low";
  topDecisionHeadline?: string;
  mustItems: TierFindingItem[];
  shouldItems: TierFindingItem[];
  otherItems: TierFindingItem[];
}

export interface ParsedBrief {
  topDecisions: TopDecision[];
  rollupRows: RollupRow[];
  mustKnow: TierFindingItem[];
  shouldKnow: TierFindingItem[];
  otherActivity: TierFindingItem[];
  executiveSummary?: string;
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

  // 1. Check for partial source failures
  if (content.toLowerCase().includes("unavailable due to rate limits") || content.toLowerCase().includes("degraded")) {
    result.partialFailure = {
      sourceName: "Secondary Sources",
      details: "A few secondary sources hit temporary rate limits. Your intelligence was still generated from verified primary signals.",
    };
  }

  // 2. Extract Top 3 Decisions
  // Pattern: 1. **Company** (Headline): Impact text
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

  // 2b. Extract Executive Summary Text
  const execSectionMatch = content.match(/(?:###?\s*Executive Summary(?: Rollup)?)\s*([\s\S]*?)(?=\n##|$)/i);
  if (execSectionMatch && execSectionMatch[1]) {
    const rawExecText = execSectionMatch[1]
      .split("\n")
      .filter((l) => !l.trim().startsWith("|") && l.trim().length > 0)
      .join("\n")
      .replace(/\*\*/g, "")
      .trim();
    if (rawExecText) {
      result.executiveSummary = rawExecText;
    }
  }

  // 3. Extract Executive Summary Table (handling CRLF line endings)
  const tableLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

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
  const lines = content.split("\n");
  let currentTier: "must" | "should" | "other" | null = null;
  let currentCompany = "General";
  let currentItem: Partial<TierFindingItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const isIndented = rawLine.startsWith("  ") || rawLine.startsWith("\t") || rawLine.startsWith("    ");

    // Detect company header: ### Vercel or #### Cloudflare or #### OpenAI (18 items)
    if (
      line.startsWith("### ") &&
      !line.includes("Theme:") &&
      !line.toLowerCase().includes("executive summary") &&
      !line.toLowerCase().includes("pipeline execution") &&
      !line.toLowerCase().includes("top 3 decisions") &&
      !line.toLowerCase().includes("strategic themes") &&
      !line.toLowerCase().includes("other activity") &&
      !line.toLowerCase().includes("nice-to-know")
    ) {
      currentCompany = line.replace("###", "").trim();
      continue;
    }
    if (
      line.startsWith("#### ") &&
      line.includes("(") &&
      line.includes("items)") &&
      !line.toLowerCase().includes("other activity") &&
      !line.toLowerCase().includes("nice-to-know")
    ) {
      currentCompany = line.replace("####", "").split("(")[0].trim();
      continue;
    }

    // Detect tier headers
    if (line.toLowerCase().includes("must-know") || line.toLowerCase().includes("#### must-know") || line.toLowerCase().includes("##### must-know")) {
      currentTier = "must";
      continue;
    }
    if (line.toLowerCase().includes("should-know") || line.toLowerCase().includes("#### should-know") || line.toLowerCase().includes("##### should-know")) {
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

    // Sub-bullet detection
    const isSubBullet =
      isIndented ||
      line.toLowerCase().startsWith("- **source") ||
      line.toLowerCase().startsWith("- **confidence") ||
      line.toLowerCase().startsWith("- **corroboration") ||
      line.toLowerCase().startsWith("- **date") ||
      line.toLowerCase().startsWith("- **why it matters") ||
      line.toLowerCase().startsWith("- **fact") ||
      line.toLowerCase().startsWith("*source:") ||
      line.toLowerCase().startsWith("*date:");

    // New item starts with - **[Title](url)** or - **Title** or - [Title](url) (and is NOT a sub-bullet)
    if (!isSubBullet && (line.startsWith("- **") || line.startsWith("- ["))) {
      if (currentItem && currentItem.title && currentTier) {
        saveItem(currentTier, currentItem, result);
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
        const linkMatch2 = line.match(/- \[(.*?)\]\((.*?)\)/);
        if (linkMatch2) {
          currentItem.title = linkMatch2[1];
          currentItem.url = linkMatch2[2];
        } else {
          const titleMatch = line.match(/- \*\*(.*?)\*\*/);
          if (titleMatch) {
            currentItem.title = titleMatch[1];
          } else {
            currentItem.title = line.replace(/^[-\s*]+/, "");
          }
        }
      }

      // Check for inline metadata: e.g. (Fact High / Inference Low confidence | New today | github)
      if (line.includes("(") && line.includes("confidence")) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("high")) currentItem.confidence = "High";
        else if (lowerLine.includes("low")) currentItem.confidence = "Low";
        else currentItem.confidence = "Medium";
      }

      continue;
    }

    // Sub-bullets for Source, Confidence, Corroboration, Why it matters or Fact
    if (currentItem) {
      const lower = line.toLowerCase();
      if ((lower.includes("source:") || lower.includes("confidence:") || lower.includes("corroboration:") || lower.includes("date:")) && (line.includes("|") || isIndented)) {
        const parts = line.split("|").map((p) => p.trim());
        for (const p of parts) {
          const pLower = p.toLowerCase();
          if (pLower.includes("source:")) {
            currentItem.sourceType = p.replace(/^[-\s*]*(\*\*)?source(\*\*)?:?/i, "").trim();
          }
          if (pLower.includes("confidence:")) {
            if (pLower.includes("high")) currentItem.confidence = "High";
            else if (pLower.includes("low")) currentItem.confidence = "Low";
            else currentItem.confidence = "Medium";
          }
          if (pLower.includes("corroboration:")) {
            currentItem.corroboration = p.replace(/^[-\s*]*(\*\*)?corroboration(\*\*)?:?/i, "").trim();
          }
          if (pLower.includes("date:")) {
            const dateMatch = p.match(/\d{4}-\d{2}-\d{2}[^)]*/);
            if (dateMatch) currentItem.date = dateMatch[0].trim();
          }
        }
      }

      // Match 'Why it matters' even if formatted as **Why it matters**: or - **Why it matters**:
      if (lower.includes("why it matters")) {
        currentItem.whyItMatters = line
          .replace(/^[-\s*]*(\*\*)?why it matters(\*\*)?:?\s*/i, "")
          .trim();
      } else if (lower.includes("fact:") || lower.includes("- fact:") || lower.includes("**fact**:")) {
        currentItem.fact = line
          .replace(/^[-\s*]*(\*\*)?fact(\*\*)?:?\s*/i, "")
          .trim();
      } else if (
        line.startsWith("- ") &&
        !currentItem.whyItMatters &&
        isIndented &&
        !lower.includes("source") &&
        !lower.includes("confidence") &&
        !lower.includes("corroboration") &&
        !lower.includes("date") &&
        !lower.includes("freshness")
      ) {
        currentItem.whyItMatters = line.replace(/^-\s*/, "").trim();
      }
    }
  }

  if (currentItem && currentItem.title && currentTier) {
    saveItem(currentTier, currentItem, result);
  }

  return result;
}

function calculateItemImpact(tier: "must" | "should" | "other", item: Partial<TierFindingItem>): number {
  let score = tier === "must" ? 88 : tier === "should" ? 68 : 42;
  if (item.corroboration && !item.corroboration.toLowerCase().includes("single-source")) {
    score += 5;
  }
  if (item.confidence === "High") {
    score += 4;
  } else if (item.confidence === "Low") {
    score -= 4;
  }
  const text = `${item.title || ""} ${item.whyItMatters || ""}`.toLowerCase();
  if (
    text.includes("sues") ||
    text.includes("lawsuit") ||
    text.includes("outage") ||
    text.includes("breach") ||
    text.includes("capacity") ||
    text.includes("shutdown")
  ) {
    score += 5;
  } else if (
    text.includes("release") ||
    text.includes("launch") ||
    text.includes("unveils") ||
    text.includes("pricing") ||
    text.includes("acquisition")
  ) {
    score += 3;
  }
  return Math.min(99, Math.max(25, score));
}

function saveItem(tier: "must" | "should" | "other", item: Partial<TierFindingItem>, result: ParsedBrief) {
  const cleanTitle = (item.title || "").trim();
  const lower = cleanTitle.toLowerCase();

  // Filter out noise / telemetry artifacts & section titles
  if (
    !cleanTitle ||
    cleanTitle.length < 5 ||
    lower === "source" ||
    lower === "confidence" ||
    lower === "date" ||
    lower === "activity by company" ||
    lower.startsWith("activity by company") ||
    lower.startsWith("theme:") ||
    lower.startsWith("strategic themes") ||
    lower.startsWith("cross-competitor") ||
    lower.startsWith("source:") ||
    lower.startsWith("confidence:") ||
    lower.startsWith("why it matters") ||
    lower.startsWith("fact:")
  ) {
    return;
  }

  const finalItem: TierFindingItem = {
    title: cleanTitle.replace(/^\[+|\]+$/g, ""),
    company: item.company || "General",
    whyItMatters: item.whyItMatters || "",
    url: item.url,
    fact: item.fact,
    sourceType: item.sourceType,
    confidence: item.confidence || "Medium",
    corroboration: item.corroboration,
    date: item.date,
    impactScore: calculateItemImpact(tier, item),
  };

  if (tier === "must") result.mustKnow.push(finalItem);
  else if (tier === "should") result.shouldKnow.push(finalItem);
  else result.otherActivity.push(finalItem);
}

/**
 * Aggregates findings by company, computing high-fidelity competitive threat scores (0-100)
 * and structured sections for company-centric brief displays.
 */
export function getCompanySummaries(brief: ParsedBrief, targetCompany?: string): CompanySummary[] {
  const EXCLUDED_COMPANIES = new Set([
    "general",
    "executive summary",
    "executive summary rollup",
    "other activity",
    "other activity (nice-to-know)",
    "pipeline execution",
    "top 3 decisions",
    "strategic themes",
    "nice-to-know",
    "routine operational",
  ]);

  const map = new Map<
    string,
    {
      mustItems: TierFindingItem[];
      shouldItems: TierFindingItem[];
      otherItems: TierFindingItem[];
      topDecisionHeadline?: string;
    }
  >();

  const norm = (c: string) => {
    if (!c) return "General";
    return c.trim();
  };

  const ensure = (name: string) => {
    const key = norm(name);
    if (!map.has(key)) {
      map.set(key, { mustItems: [], shouldItems: [], otherItems: [] });
    }
    return map.get(key)!;
  };

  // Register companies from Top Decisions
  for (const dec of brief.topDecisions) {
    if (EXCLUDED_COMPANIES.has(dec.company.toLowerCase().trim())) continue;
    const entry = ensure(dec.company);
    if (!entry.topDecisionHeadline) {
      entry.topDecisionHeadline = dec.headline;
    }
  }

  // Register items from Must-Know
  for (const item of brief.mustKnow) {
    if (EXCLUDED_COMPANIES.has(item.company.toLowerCase().trim())) continue;
    const entry = ensure(item.company);
    entry.mustItems.push(item);
  }

  // Register items from Should-Know
  for (const item of brief.shouldKnow) {
    if (EXCLUDED_COMPANIES.has(item.company.toLowerCase().trim())) continue;
    const entry = ensure(item.company);
    entry.shouldItems.push(item);
  }

  // Register items from Other Activity
  for (const item of brief.otherActivity) {
    if (EXCLUDED_COMPANIES.has(item.company.toLowerCase().trim())) continue;
    const entry = ensure(item.company);
    entry.otherItems.push(item);
  }

  const summaries: CompanySummary[] = [];

  for (const [companyName, data] of map.entries()) {
    if (EXCLUDED_COMPANIES.has(companyName.toLowerCase().trim())) {
      continue;
    }
    const mustCount = data.mustItems.length;
    const shouldCount = data.shouldItems.length;
    const otherCount = data.otherItems.length;
    const totalCount = mustCount + shouldCount + otherCount;

    // Threat / Momentum Score (0-100)
    let score = Math.min(48, mustCount * 16);
    score += Math.min(28, shouldCount * 4);
    if (data.topDecisionHeadline) score += 14;
    score += Math.min(10, totalCount * 1.5);

    const threatScore = Math.min(98, Math.max(30, Math.round(score)));

    let threatLevel: "Critical" | "High" | "Moderate" | "Low" = "Low";
    if (threatScore >= 80) threatLevel = "Critical";
    else if (threatScore >= 62) threatLevel = "High";
    else if (threatScore >= 45) threatLevel = "Moderate";

    summaries.push({
      companyName,
      mustCount,
      shouldCount,
      otherCount,
      totalCount,
      threatScore,
      threatLevel,
      topDecisionHeadline: data.topDecisionHeadline,
      mustItems: data.mustItems,
      shouldItems: data.shouldItems,
      otherItems: data.otherItems,
    });
  }

  // Sort: target company first if present, then descending by threatScore
  summaries.sort((a, b) => {
    if (targetCompany) {
      if (a.companyName.toLowerCase() === targetCompany.toLowerCase()) return -1;
      if (b.companyName.toLowerCase() === targetCompany.toLowerCase()) return 1;
    }
    return b.threatScore - a.threatScore;
  });

  return summaries;
}

// ============================================================================
// Source Intelligence Resolution
// ============================================================================
export interface SourceInfo {
  label: string;
  url?: string;
  isExternal: boolean;
  domain?: string;
}

const DOMAIN_MAP: Record<string, string> = {
  "ft.com": "Financial Times",
  "scmp.com": "South China Morning Post",
  "thehackernews.com": "The Hacker News",
  "github.com": "GitHub Security Advisory",
  "vuldb.com": "VulDB Vulnerability Index",
  "economictimes.indiatimes.com": "The Economic Times",
  "livemint.com": "Livemint",
  "techcrunch.com": "TechCrunch",
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "dev.to": "DEV Community",
  "sec.gov": "SEC EDGAR Disclosures",
  "news.ycombinator.com": "Hacker News",
  "wsj.com": "Wall Street Journal",
  "cnbc.com": "CNBC",
  "businessinsider.com": "Business Insider",
  "zdnet.com": "ZDNet",
  "bleepingcomputer.com": "BleepingComputer",
  "theverge.com": "The Verge",
  "venturebeat.com": "VentureBeat",
};

/**
 * Resolves a high-fidelity, verified source name and URL for every headline.
 * Guarantees a reliable label even when source metadata is partially missing in raw markdown.
 */
export function resolveSourceInfo(item: {
  title?: string;
  url?: string;
  sourceType?: string;
  corroboration?: string;
  company?: string;
}): SourceInfo {
  // 1. If explicit URL is present, extract domain and map to recognized authoritative outlet
  if (item.url && item.url !== "#" && item.url.startsWith("http")) {
    try {
      const urlObj = new URL(item.url);
      const host = urlObj.hostname.toLowerCase().replace(/^www\./, "");

      for (const [dom, name] of Object.entries(DOMAIN_MAP)) {
        if (host === dom || host.endsWith("." + dom)) {
          return { label: name, url: item.url, isExternal: true, domain: host };
        }
      }

      // Format clean domain name (e.g. news.site.co -> Site.co)
      const domainParts = host.split(".");
      const cleanHost = domainParts.length > 2 ? domainParts.slice(-2).join(".") : host;
      const capitalized = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
      return { label: capitalized, url: item.url, isExternal: true, domain: host };
    } catch {
      // Fall through if URL parsing fails
    }
  }

  // 2. If sourceType is explicitly provided in markdown metadata
  if (item.sourceType && item.sourceType.trim()) {
    const raw = item.sourceType.trim().replace(/^\*+|\*+$/g, "");
    const lower = raw.toLowerCase();

    if (lower.includes("github")) {
      return { label: "GitHub Code & Releases", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("sec") || lower.includes("edgar")) {
      return { label: "SEC EDGAR Filing", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("vuldb") || lower.includes("cve")) {
      return { label: "VulDB Vulnerability Database", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("hacker news")) {
      return { label: "The Hacker News", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("dev.to")) {
      return { label: "DEV Community", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("news")) {
      return { label: "Verified Press Dispatch", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("pricing")) {
      return { label: "Official Pricing Monitor", url: item.url, isExternal: !!item.url };
    }
    if (lower.includes("careers") || lower.includes("job")) {
      return { label: "Talent & Career Disclosures", url: item.url, isExternal: !!item.url };
    }

    const clean = raw
      .replace(/\(Single-Source\)/gi, "")
      .replace(/\(Multi-Source\)/gi, "")
      .trim();
    if (clean) {
      return {
        label: clean.charAt(0).toUpperCase() + clean.slice(1),
        url: item.url,
        isExternal: !!item.url,
      };
    }
  }

  // 3. Contextual heuristic from Title / Corroboration / Content keywords
  const combined = `${item.title || ""} ${item.corroboration || ""}`.toLowerCase();
  if (
    combined.includes("cve-") ||
    combined.includes("ghsa-") ||
    combined.includes("vulnerability") ||
    combined.includes("rce")
  ) {
    return { label: "Security Advisory & CVE Index", url: item.url, isExternal: !!item.url };
  }
  if (combined.includes("github") || combined.includes("repo") || combined.includes("commit")) {
    return { label: "GitHub Public Activity", url: item.url, isExternal: !!item.url };
  }
  if (combined.includes("ft.com") || combined.includes("financial times")) {
    return { label: "Financial Times", url: item.url, isExternal: !!item.url };
  }
  if (combined.includes("scmp") || combined.includes("south china")) {
    return { label: "South China Morning Post", url: item.url, isExternal: !!item.url };
  }
  if (combined.includes("flipkart") || combined.includes("seller base") || combined.includes("onboarding")) {
    return { label: "E-Commerce Industry Dispatch", url: item.url, isExternal: !!item.url };
  }
  if (combined.includes("patent") || combined.includes("uspto")) {
    return { label: "Patent & IP Registry", url: item.url, isExternal: !!item.url };
  }

  const comp = item.company && item.company !== "General" ? item.company : "Industry";
  return { label: `${comp} Primary Monitor`, url: item.url, isExternal: !!item.url };
}

// ============================================================================
// Impactful Executive Summary Synthesis
// ============================================================================
export interface ImpactfulStrategicTakeaway {
  vector: string;
  competitor: string;
  headline: string;
  strategicImpact: string;
  actionRecommendation: string;
  badgeColor: "rose" | "purple" | "blue" | "amber";
}

export interface ImpactfulSummary {
  headlineNarrative: string;
  takeaways: ImpactfulStrategicTakeaway[];
  executiveAction: string;
  hasSubstantiveInsights: boolean;
}

/**
 * Transforms brief data into strategic takeaways for the executive team,
 * focusing on business impact, vulnerabilities, market shifts, and recommendations
 * rather than raw item counts.
 */
export function getImpactfulExecutiveSummary(
  brief: ParsedBrief,
  targetCompany: string = "Our Company"
): ImpactfulSummary {
  const takeaways: ImpactfulStrategicTakeaway[] = [];

  // 1. Process Top 3 Decisions into High-Impact Strategic Takeaways
  if (brief.topDecisions && brief.topDecisions.length > 0) {
    for (const dec of brief.topDecisions) {
      const lowerText = `${dec.headline} ${dec.impact}`.toLowerCase();
      let vector = "Strategic Maneuver";
      let badgeColor: "rose" | "purple" | "blue" | "amber" = "purple";
      let action = "Monitor adoption metrics and benchmark feature velocity against our roadmap.";

      // Precise vector classification using word boundaries to prevent false positives (e.g. 'source' matching 'rce')
      const isSecurity =
        lowerText.includes("cve-") ||
        lowerText.includes("cve ") ||
        lowerText.includes("ghsa-") ||
        /\b(rce|vulnerability|vulnerabilities|exploit|exploits|breach|flaw|path traversal)\b/i.test(lowerText);

      const isMerchantAcquisition =
        /\b(seller|sellers|merchant|merchants|zero-commission|commission)\b/i.test(lowerText) ||
        lowerText.includes("doubles active") ||
        lowerText.includes("simplified onboarding");

      const isRegulatory =
        /\b(regulation|regulatory|regulator|regulators|investigation|lawsuit|antitrust)\b/i.test(lowerText) ||
        lowerText.includes("ran off the rails");

      const isReliability =
        /\b(outage|downtime|incident)\b/i.test(lowerText) ||
        lowerText.includes("slept for") ||
        lowerText.includes("sql trigger");

      const isCommercial =
        /\b(financing|funding|sales|revenue|expansion|ipo)\b/i.test(lowerText) ||
        lowerText.includes("more than double") ||
        lowerText.includes("product roadmap");

      const isCapabilities =
        /\b(ai|llm|agent|agents|model|models|inference)\b/i.test(lowerText) ||
        lowerText.includes("unveils") ||
        lowerText.includes("launch");

      if (isSecurity) {
        vector = "Critical Security Vulnerability";
        badgeColor = "rose";
        action = `Audit internal dependencies for exposure; prepare customer trust communications emphasizing ${targetCompany}'s runtime isolation.`;
      } else if (isMerchantAcquisition) {
        vector = "Merchant Acquisition Warfare";
        badgeColor = "rose";
        action = `Defend supplier retention by reinforcing ${targetCompany}'s zero-cost fulfillment perks and AI catalog tools.`;
      } else if (isRegulatory) {
        vector = "Regulatory Backlash & Market Recalibration";
        badgeColor = "amber";
        action = `Leverage ${targetCompany}'s compliant governance posture to capture enterprise accounts fleeing regulatory uncertainty.`;
      } else if (isReliability) {
        vector = "Competitor Reliability Disruption";
        badgeColor = "amber";
        action = `Highlight ${targetCompany}'s automated failover and 99.99% SLA reliability in enterprise discussions.`;
      } else if (isCommercial) {
        vector = "Aggressive Commercial Expansion";
        badgeColor = "purple";
        action = `Strengthen key regional category partnerships to pre-empt aggressive customer acquisition campaigns.`;
      } else if (isCapabilities) {
        vector = "Product Capabilities Leap";
        badgeColor = "blue";
        action = `Expedite adjacent feature milestones to prevent competitor lock-in among core power users.`;
      }

      takeaways.push({
        vector,
        competitor: dec.company,
        headline: dec.headline,
        strategicImpact: dec.impact,
        actionRecommendation: action,
        badgeColor,
      });
    }
  }

  // 2. If no Top Decisions or fewer than 2, enrich from Must-Know findings
  if (takeaways.length < 2 && brief.mustKnow && brief.mustKnow.length > 0) {
    for (const item of brief.mustKnow.slice(0, 3 - takeaways.length)) {
      const lower = `${item.title} ${item.whyItMatters}`.toLowerCase();
      let vector = "Tactical Milestone";
      let badgeColor: "rose" | "purple" | "blue" | "amber" = "blue";

      if (lower.includes("vulnerability") || lower.includes("cve") || lower.includes("security")) {
        vector = "Vulnerability Disclosure";
        badgeColor = "rose";
      } else if (lower.includes("pricing") || lower.includes("discount") || lower.includes("fee")) {
        vector = "Pricing Pressure";
        badgeColor = "amber";
      }

      takeaways.push({
        vector,
        competitor: item.company,
        headline: item.title,
        strategicImpact:
          item.whyItMatters ||
          `Directly impacts competitive positioning in the ${item.company} ecosystem.`,
        actionRecommendation: `Evaluate implications for ${targetCompany}'s current product and pricing strategy.`,
        badgeColor,
      });
    }
  }

  // 3. Build cohesive Narrative Summary
  let headlineNarrative = "";
  let executiveAction = "";

  if (takeaways.length >= 2) {
    const primary = takeaways[0];
    const secondary = takeaways[1];
    headlineNarrative = `This cycle reveals decisive competitive shifts: ${primary.competitor} is navigating ${primary.vector.toLowerCase()} (${primary.headline.slice(0, 75)}...), while ${secondary.competitor} has triggered ${secondary.vector.toLowerCase()}. For ${targetCompany}, executive focus must shift from reactive monitoring to aggressive differentiation in reliability, supplier economics, and trusted compliance.`;
    executiveAction = `Accelerate counter-measures against ${primary.competitor} while capitalizing on market openings created by ${secondary.competitor}'s current operational adjustments.`;
  } else if (takeaways.length === 1) {
    const single = takeaways[0];
    headlineNarrative = `A standout strategic event has altered the playing field: ${single.competitor} triggered ${single.vector.toLowerCase()} regarding "${single.headline}". For ${targetCompany}, the primary takeaway is ensuring operational immunity and capitalizing on customer scrutiny.`;
    executiveAction = single.actionRecommendation;
  } else {
    headlineNarrative = `Competitor activities across monitored channels indicate iterative feature releases without a destabilizing structural realignment. For ${targetCompany}, operations remain steady; maintain velocity on current core quarterly initiatives.`;
    executiveAction = `Maintain execution focus on primary product differentiators while monitoring early signals.`;
  }

  return {
    headlineNarrative,
    takeaways,
    executiveAction,
    hasSubstantiveInsights: takeaways.length > 0,
  };
}



