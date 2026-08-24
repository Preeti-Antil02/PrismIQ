import {
  CompanyRollup,
  CompanySection,
  Finding,
  OtherActivityItem,
  ParsedBrief,
  RollupStats,
  TopDecision,
} from "@/types/brief";

const SECURITY_KEYWORDS = [
  "security",
  "vulnerability",
  "vulnerabilities",
  "spectre",
  "side-channel",
  "exploit",
  "cve",
  "breach",
  "leak",
  "leaking",
  "outage",
  "incident",
  "malicious",
  "attack",
  "threat",
  "theft",
  "steal",
];

export function isSecurityRelated(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SECURITY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Parse raw markdown competitive intelligence brief into structured React-renderable data.
 */
export function parseMarkdownBrief(markdown: string): ParsedBrief {
  if (!markdown || !markdown.trim()) {
    return {
      title: "PrismIQ Competitive Intelligence Brief",
      topDecisions: [],
      rollup: {
        totalMonitored: 0,
        companyCount: 0,
        mustKnowTotal: 0,
        shouldKnowTotal: 0,
        niceToKnowTotal: 0,
        activityByCompany: [],
      },
      companies: [],
    };
  }

  const lines = markdown.split("\n");
  const title = lines[0]?.replace(/^#\s*/, "").trim() || "PrismIQ Competitive Intelligence Brief";

  // 1. Extract Top 3 decisions
  const topDecisions: TopDecision[] = [];
  const top3Match = markdown.match(/## Top 3 decisions this informs\n\n([\s\S]*?)(?=\n### Executive Summary Rollup|\n## Findings by Company|$)/);
  if (top3Match && top3Match[1]) {
    const top3Block = top3Match[1].trim();
    const itemRegex = /(?:^|\n)(\d+)\.\s+\*\*([^*]+)\*\*\s*\(([^)]+)\):\s*([\s\S]*?)(?=(?:\n\d+\.\s+\*\*|$))/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(top3Block)) !== null) {
      const index = parseInt(match[1], 10);
      const company = match[2].trim();
      const itemTitle = match[3].trim();
      const explanation = match[4].trim().replace(/\n+/g, " ");
      const isSec = isSecurityRelated(`${company} ${itemTitle} ${explanation}`);
      topDecisions.push({
        index,
        company,
        title: itemTitle,
        explanation,
        isSecurityRisk: isSec,
      });
    }
  }

  // 2. Extract Executive Summary Rollup
  const rollup: RollupStats = {
    totalMonitored: 0,
    companyCount: 0,
    mustKnowTotal: 0,
    shouldKnowTotal: 0,
    niceToKnowTotal: 0,
    activityByCompany: [],
  };

  const rollupMatch = markdown.match(/### Executive Summary Rollup\n\n([\s\S]*?)(?=\n## Findings by Company|$)/);
  if (rollupMatch && rollupMatch[1]) {
    const rollupBlock = rollupMatch[1].trim();

    // Total monitored line:
    // - **Total Monitored**: 180 findings across 4 companies (16 Must-Know, 103 Should-Know, 61 Nice-to-Know)
    const totalMatch = rollupBlock.match(
      /- \*\*Total Monitored\*\*:\s*(\d+)\s+findings across\s+(\d+)\s+companies\s+\((\d+)\s+Must-Know,\s*(\d+)\s+Should-Know,\s*(\d+)\s+Nice-to-Know\)/i
    );
    if (totalMatch) {
      rollup.totalMonitored = parseInt(totalMatch[1], 10);
      rollup.companyCount = parseInt(totalMatch[2], 10);
      rollup.mustKnowTotal = parseInt(totalMatch[3], 10);
      rollup.shouldKnowTotal = parseInt(totalMatch[4], 10);
      rollup.niceToKnowTotal = parseInt(totalMatch[5], 10);
    }

    // Key focus line:
    // - **Key Focus**: Cloudflare Workers recorded the highest critical activity with 8 Must-Know findings.
    const keyFocusMatch = rollupBlock.match(/- \*\*Key Focus\*\*:\s*([^\n]+)/i);
    if (keyFocusMatch) {
      rollup.keyFocus = keyFocusMatch[1].trim();
    }

    // Per-company activity lines:
    //   - **Cloudflare Pages**: 2 Must-Know, 23 Should-Know, 22 Nice-to-Know
    const companyLineRegex = /\s*-\s+\*\*([^*]+)\*\*:\s*(\d+)\s+Must-Know,\s*(\d+)\s+Should-Know,\s*(\d+)\s+Nice-to-Know/gi;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = companyLineRegex.exec(rollupBlock)) !== null) {
      rollup.activityByCompany.push({
        company: cMatch[1].trim(),
        mustKnow: parseInt(cMatch[2], 10),
        shouldKnow: parseInt(cMatch[3], 10),
        niceToKnow: parseInt(cMatch[4], 10),
      });
    }
  }

  // 3. Extract Findings by Company
  const companies: CompanySection[] = [];
  const findingsSectionMatch = markdown.match(/## Findings by Company\n\n([\s\S]*)$/);
  if (findingsSectionMatch && findingsSectionMatch[1]) {
    const findingsBlock = findingsSectionMatch[1];
    // Split into company chunks
    const companyChunks = findingsBlock.split(/\n(?=### )/);

    for (const chunk of companyChunks) {
      const trimmed = chunk.trim();
      if (!trimmed.startsWith("### ")) continue;

      const headerEnd = trimmed.indexOf("\n");
      const companyHeader = headerEnd === -1 ? trimmed : trimmed.slice(0, headerEnd);
      const companyName = companyHeader.replace("### ", "").trim();
      const body = headerEnd === -1 ? "" : trimmed.slice(headerEnd).trim();

      const mustKnow: Finding[] = [];
      const shouldKnow: Finding[] = [];
      const otherActivity: OtherActivityItem[] = [];

      // Parse Must-Know section
      const mustMatch = body.match(/#### Must-Know\n\n([\s\S]*?)(?=\n#### Should-Know|\n#### Other Activity|$)/);
      if (mustMatch && mustMatch[1]) {
        const mustBlock = mustMatch[1].trim();
        const items = mustBlock.split(/\n(?=- \*\*\[)/);
        for (const item of items) {
          const itemTrimmed = item.trim();
          if (!itemTrimmed.startsWith("- **[")) continue;

          const titleMatch = itemTrimmed.match(/^- \*\*\[(.*?)\]\((.*?)\)\*\*/);
          if (!titleMatch) continue;
          const itemTitle = titleMatch[1];
          const url = titleMatch[2];

          const metaMatch = itemTrimmed.match(/- \*\*Source\*\*:\s*(\w+)\s*\|\s*\*\*Confidence\*\*:\s*(\w+)\s*\|\s*\*\*Date\*\*:\s*([^\n]+)/);
          const source = metaMatch ? metaMatch[1].trim() : "news";
          const confidence = metaMatch ? metaMatch[2].trim() : "Medium";
          const date = metaMatch ? metaMatch[3].trim() : "Recent";

          const whyMatch = itemTrimmed.match(/- \*\*Why it matters\*\*:\s*([\s\S]*)$/);
          const whyItMatters = whyMatch ? whyMatch[1].trim().replace(/\n+/g, " ") : "";

          const isSec = isSecurityRelated(`${companyName} ${itemTitle} ${whyItMatters}`);
          mustKnow.push({
            title: itemTitle,
            url,
            source,
            confidence,
            date,
            whyItMatters,
            isSecurityRisk: isSec,
          });
        }
      }

      // Parse Should-Know section
      const shouldMatch = body.match(/#### Should-Know\n\n([\s\S]*?)(?=\n#### Other Activity|$)/);
      if (shouldMatch && shouldMatch[1]) {
        const shouldBlock = shouldMatch[1].trim();
        const items = shouldBlock.split(/\n(?=- \*\*\[)/);
        for (const item of items) {
          const itemTrimmed = item.trim();
          if (!itemTrimmed.startsWith("- **[")) continue;

          const titleMatch = itemTrimmed.match(/^- \*\*\[(.*?)\]\((.*?)\)\*\*(?:\s*\((High|Medium|Low) confidence\))?/);
          if (!titleMatch) continue;
          const itemTitle = titleMatch[1];
          const url = titleMatch[2];
          let confidence = titleMatch[3] || "Medium";

          let source = "news";
          let date = "Recent";
          let whyItMatters = "";

          const whyMatch = itemTrimmed.match(/- \*\*Why it matters\*\*:\s*([\s\S]*)$/);
          if (whyMatch) {
            const rawWhy = whyMatch[1].trim();
            // Check if trailing (*Source: {source} | Date: {date}*) exists
            const provMatch = rawWhy.match(/^(.*?)\s*\(\*Source:\s*(\w+)\s*\|\s*Date:\s*(.*?)\*\)$/);
            if (provMatch) {
              whyItMatters = provMatch[1].trim().replace(/\n+/g, " ");
              source = provMatch[2].trim();
              date = provMatch[3].trim();
            } else {
              whyItMatters = rawWhy.replace(/\n+/g, " ");
            }
          }

          const isSec = isSecurityRelated(`${companyName} ${itemTitle} ${whyItMatters}`);
          shouldKnow.push({
            title: itemTitle,
            url,
            source,
            confidence,
            date,
            whyItMatters,
            isSecurityRisk: isSec,
          });
        }
      }

      // Parse Other Activity (Nice-to-Know)
      const otherMatch = body.match(/#### Other Activity[^\n]*\n\n([\s\S]*?)(?=\n### |$)/);
      if (otherMatch && otherMatch[1]) {
        const otherBlock = otherMatch[1].trim();
        const lines = otherBlock.split("\n");
        for (const line of lines) {
          const lineTrimmed = line.trim();
          if (!lineTrimmed.startsWith("- [")) continue;

          const oMatch = lineTrimmed.match(/^- \[(.*?)\]\((.*?)\)\s*—\s*\*(.*?),\s*(.*?)\*$/);
          if (oMatch) {
            otherActivity.push({
              title: oMatch[1].trim(),
              url: oMatch[2].trim(),
              source: oMatch[3].trim(),
              date: oMatch[4].trim(),
            });
          }
        }
      }

      if (mustKnow.length > 0 || shouldKnow.length > 0 || otherActivity.length > 0) {
        companies.push({
          company: companyName,
          mustKnow,
          shouldKnow,
          otherActivity,
        });
      }
    }
  }

  return {
    title,
    topDecisions,
    rollup,
    companies,
  };
}
