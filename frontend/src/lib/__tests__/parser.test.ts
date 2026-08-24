import { describe, expect, it } from "vitest";
import { isSecurityRelated, parseMarkdownBrief } from "../parser";

const SAMPLE_BRIEF = `# PrismIQ Competitive Intelligence Brief

## Top 3 decisions this informs

1. **Cloudflare Workers** (Spectre Side-Channel Vulnerability Disclosed): Critical remote memory vulnerability in V8 isolate runtime leaks authorization JWT tokens.
2. **Vercel** (Vercel Releases AI Readiness Scoreboard): Strategic move to benchmark AI agent readiness across the web ecosystem.
3. **Netlify** (Netlify Launches In-House Git Infrastructure): Major effort to reduce dependence on external Git providers.

### Executive Summary Rollup

- **Total Monitored**: 45 findings across 3 companies (5 Must-Know, 25 Should-Know, 15 Nice-to-Know)
- **Key Focus**: Cloudflare Workers recorded the highest critical activity with 3 Must-Know findings.
- **Activity by Company**:
  - **Cloudflare Workers**: 3 Must-Know, 10 Should-Know, 5 Nice-to-Know
  - **Netlify**: 0 Must-Know, 8 Should-Know, 5 Nice-to-Know
  - **Vercel**: 2 Must-Know, 7 Should-Know, 5 Nice-to-Know

## Findings by Company

### Vercel

#### Must-Know

- **[Is Agentic by Vercel — AI Agent Readiness Score](https://is-agentic.com)**
  - **Source**: news | **Confidence**: High | **Date**: 2026-08-22 05:32:38 +0000
  - **Why it matters**: Evaluates site readiness for AI agents and provides evidence-based recommendations.

#### Should-Know

- **[Always-on tracing for production and preview traffic](https://vercel.com/changelog/tracing)** (High confidence)
  - **Why it matters**: Collects sampled traces from live preview environments. (*Source: news | Date: 2026-08-21 00:00:00 +0000*)

#### Other Activity (2 items)

- [GitHub WatchEvent started in vercel/next.js](https://github.com/vercel/next.js) — *github, 2026-08-22T18:52:56Z*
- [GitHub ForkEvent forked in vercel/vercel](https://github.com/vercel/vercel) — *github, 2026-08-22T19:12:24Z*

### Netlify

#### Should-Know

- **[The full power of Git, without the friction](https://www.netlify.com/blog/git)** (High confidence)
  - **Why it matters**: Explores AI-augmented version control. (*Source: news | Date: 2026-08-17 14:47:27 +0000*)

#### Other Activity (1 items)

- [GitHub WatchEvent started in netlify/axis](https://github.com/netlify/axis) — *github, 2026-08-22T07:06:09Z*

### Cloudflare Workers

#### Must-Know

- **[Spectre side-channel vulnerability leaks JWT](https://news.example.com/spectre)**
  - **Source**: news | **Confidence**: High | **Date**: 2026-08-21 12:00:00 +0000
  - **Why it matters**: Critical security exploit allows cross-isolate secret exfiltration.
`;

describe("parseMarkdownBrief", () => {
  it("extracts Top 3 decisions accurately", () => {
    const parsed = parseMarkdownBrief(SAMPLE_BRIEF);
    expect(parsed.topDecisions).toHaveLength(3);

    expect(parsed.topDecisions[0]).toEqual({
      index: 1,
      company: "Cloudflare Workers",
      title: "Spectre Side-Channel Vulnerability Disclosed",
      explanation: "Critical remote memory vulnerability in V8 isolate runtime leaks authorization JWT tokens.",
      isSecurityRisk: true,
    });

    expect(parsed.topDecisions[1]).toEqual({
      index: 2,
      company: "Vercel",
      title: "Vercel Releases AI Readiness Scoreboard",
      explanation: "Strategic move to benchmark AI agent readiness across the web ecosystem.",
      isSecurityRisk: false,
    });
  });

  it("extracts Executive Summary Rollup statistics", () => {
    const parsed = parseMarkdownBrief(SAMPLE_BRIEF);
    expect(parsed.rollup.totalMonitored).toBe(45);
    expect(parsed.rollup.companyCount).toBe(3);
    expect(parsed.rollup.mustKnowTotal).toBe(5);
    expect(parsed.rollup.shouldKnowTotal).toBe(25);
    expect(parsed.rollup.niceToKnowTotal).toBe(15);
    expect(parsed.rollup.keyFocus).toBe("Cloudflare Workers recorded the highest critical activity with 3 Must-Know findings.");

    expect(parsed.rollup.activityByCompany).toHaveLength(3);
    expect(parsed.rollup.activityByCompany[0]).toEqual({
      company: "Cloudflare Workers",
      mustKnow: 3,
      shouldKnow: 10,
      niceToKnow: 5,
    });
    expect(parsed.rollup.activityByCompany[1]).toEqual({
      company: "Netlify",
      mustKnow: 0,
      shouldKnow: 8,
      niceToKnow: 5,
    });
  });

  it("extracts company-grouped findings with accurate tiers", () => {
    const parsed = parseMarkdownBrief(SAMPLE_BRIEF);
    expect(parsed.companies).toHaveLength(3);

    // Vercel (Must-Know, Should-Know, Other Activity)
    const vercel = parsed.companies.find((c) => c.company === "Vercel")!;
    expect(vercel).toBeDefined();
    expect(vercel.mustKnow).toHaveLength(1);
    expect(vercel.mustKnow[0].title).toBe("Is Agentic by Vercel — AI Agent Readiness Score");
    expect(vercel.mustKnow[0].url).toBe("https://is-agentic.com");
    expect(vercel.mustKnow[0].confidence).toBe("High");
    expect(vercel.shouldKnow).toHaveLength(1);
    expect(vercel.shouldKnow[0].title).toBe("Always-on tracing for production and preview traffic");
    expect(vercel.otherActivity).toHaveLength(2);

    // Netlify (0 Must-Know, 1 Should-Know, 1 Other Activity)
    const netlify = parsed.companies.find((c) => c.company === "Netlify")!;
    expect(netlify).toBeDefined();
    expect(netlify.mustKnow).toHaveLength(0);
    expect(netlify.shouldKnow).toHaveLength(1);
    expect(netlify.otherActivity).toHaveLength(1);
  });

  it("handles empty or malformed markdown gracefully", () => {
    const parsed = parseMarkdownBrief("");
    expect(parsed.topDecisions).toEqual([]);
    expect(parsed.rollup.totalMonitored).toBe(0);
    expect(parsed.companies).toEqual([]);
  });
});

describe("isSecurityRelated", () => {
  it("identifies security risk keywords accurately", () => {
    expect(isSecurityRelated("Spectre vulnerability in isolate runtime")).toBe(true);
    expect(isSecurityRelated("40 Malicious Firefox extensions steal credentials")).toBe(true);
    expect(isSecurityRelated("Vercel updates CLI domains support")).toBe(false);
    expect(isSecurityRelated("")).toBe(false);
  });
});
