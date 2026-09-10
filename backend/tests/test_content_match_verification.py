"""
Tests demonstrating Content-Match Verification (Part 3 of Grounding Discipline).

Demonstrates the vulnerability of the old URL-syntax-only check and proves that the new
content-match verification guard successfully rejects both:
1. Item-5-style failure: Real resolvable source (arXiv 2608.12345), but fabricated title and topic claims.
2. Item-7-style failure: Real resolvable web URL (Cloudflare blog), but fabricated title/excerpt/topic mapping.
"""

import pytest
from src import research_radar


def old_logic_evaluate_candidate(item: dict, topic_label: str, keywords: list) -> bool:
    """
    Simulates the prior 'syntax-only' validation logic:
    - Only checked whether the URL was syntactically valid and non-placeholder.
    - Matched keywords against the CLAIMED dictionary text without verifying real source content.
    """
    can_url = item.get("canonical_url") or item.get("url", "")
    if not research_radar.is_valid_grounded_url(can_url):
        return False
    matched_topics = item.get("matched_topics", [])
    if topic_label in matched_topics:
        return True
    corpus = f"{item.get('title', '')} {item.get('raw_excerpt', '')}"
    if research_radar._match_keywords_in_text(corpus, keywords):
        return True
    return False


def test_old_logic_vulnerability_accepts_fabricated_claims_on_real_urls():
    """
    Demonstrates that the old logic had a critical blind spot:
    Because it trusted the claimed title/excerpt, it accepted fabricated claims on real URLs.
    """
    topic_label = "WASM at the edge"
    keywords = ["wasm", "webassembly", "edge runtime", "v8 isolates", "microvm"]

    # Item 5 (Fabricated claim on real arXiv ID 2608.12345)
    item_5_claimed = {
        "title": "Post-Quantum Origin Authentication in Edge Architectures",
        "url": "https://arxiv.org/abs/2608.12345",
        "canonical_url": "https://arxiv.org/abs/2608.12345",
        "raw_excerpt": "We benchmark ML-DSA and post-quantum key exchange in edge proxies using WASM sandbox runtimes.",
        "matched_topics": ["WASM at the edge"],
    }

    # Item 7 (Fabricated title & excerpt on real Cloudflare blog URL)
    item_7_claimed = {
        "title": "Five Rust-Level Memory Optimizations to DNS Cache Layout",
        "url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111/",
        "canonical_url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111",
        "raw_excerpt": "Deep dive into memory layout, zero-copy buffers, and edge runtime performance cutting memory by 56%.",
        "matched_topics": ["WASM at the edge"],
    }

    # VULNERABILITY DEMONSTRATION:
    # Under old logic, both fabricated items are mistakenly accepted!
    assert old_logic_evaluate_candidate(item_5_claimed, topic_label, keywords) is True, (
        "Old logic vulnerability: accepted Item 5 despite completely fabricated title/abstract"
    )
    assert old_logic_evaluate_candidate(item_7_claimed, topic_label, keywords) is True, (
        "Old logic vulnerability: accepted Item 7 despite fabricated title and topic distortion"
    )


def test_new_content_match_guard_rejects_item5_and_item7():
    """
    Demonstrates that the new content-match verification guard successfully rejects both
    Item 5 and Item 7 by comparing claimed attributes against real fetched source content.
    """
    topic_label = "WASM at the edge"
    keywords = ["wasm", "webassembly", "edge runtime", "v8 isolates", "microvm"]

    # Real fetched content for arXiv 2608.12345 (an AI paper on LLM scientific integrity)
    item_5_with_real_content = {
        "title": "Post-Quantum Origin Authentication in Edge Architectures",  # FABRICATED CLAIM
        "url": "https://arxiv.org/abs/2608.12345",
        "canonical_url": "https://arxiv.org/abs/2608.12345",
        "raw_excerpt": "We benchmark ML-DSA... using WASM sandbox runtimes.", # FABRICATED CLAIM
        "matched_topics": ["WASM at the edge"],
        "fetched_title": "Diagnostic Foundation for Evaluating LLMs' Research Integrity as Co-Scientists",
        "fetched_text": "Language models are increasingly deployed as co-scientists, yet their ability to uphold research integrity and avoid scientific hallucination remains untested.",
    }

    is_grounded_5, reason_5, meta_5 = research_radar.verify_content_match(
        url=item_5_with_real_content["canonical_url"],
        claimed_title=item_5_with_real_content["title"],
        topic_label=topic_label,
        topic_keywords=keywords,
        live_fetch=False,
        fetched_title=item_5_with_real_content["fetched_title"],
        fetched_text=item_5_with_real_content["fetched_text"],
    )

    # NEW LOGIC DEMONSTRATION: Item 5 is REJECTED
    assert is_grounded_5 is False
    assert "Topic content mismatch" in reason_5
    assert len(meta_5["matched_terms"]) == 0

    # Real fetched content for Cloudflare blog (about 1.1.1.1 DNS cache, not WASM)
    item_7_with_real_content = {
        "title": "Five Rust-Level Memory Optimizations to DNS Cache Layout",  # FABRICATED TITLE
        "url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111/",
        "canonical_url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111",
        "raw_excerpt": "Deep dive into memory layout... cutting memory by 56%.", # FABRICATED CLAIM
        "matched_topics": ["WASM at the edge"],
        "fetched_title": "How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache | Cloudflare Blog",
        "fetched_text": "In this post we describe how our engineers redesigned the 1.1.1.1 DNS resolver cache in Rust using lock-free data structures, saving over 100 terabytes of memory across our global edge nodes.",
    }

    is_grounded_7, reason_7, meta_7 = research_radar.verify_content_match(
        url=item_7_with_real_content["canonical_url"],
        claimed_title=item_7_with_real_content["title"],
        topic_label=topic_label,
        topic_keywords=keywords,
        live_fetch=False,
        fetched_title=item_7_with_real_content["fetched_title"],
        fetched_text=item_7_with_real_content["fetched_text"],
    )

    # NEW LOGIC DEMONSTRATION: Item 7 is REJECTED
    assert is_grounded_7 is False
    assert "Topic content mismatch" in reason_7
    assert len(meta_7["matched_terms"]) == 0


def test_new_content_match_guard_passes_genuine_item():
    """
    Demonstrates that a genuine, factual item whose actual fetched content contains the
    topic terms and matches the claimed title successfully PASSES content-match verification.
    """
    topic_label = "AI agent tooling"
    keywords = ["mcp", "model context protocol", "agentic", "tool calling", "ai agent"]

    genuine_item = {
        "title": "ReCite: Agentic Reasoning for Faithful Citation",
        "url": "https://arxiv.org/abs/2609.09156",
        "canonical_url": "https://arxiv.org/abs/2609.09156",
        "matched_topics": ["AI agent tooling"],
        "fetched_title": "ReCite: Agentic Reasoning for Faithful Citation",
        "fetched_text": "Accurate citations are the foundation of academic writing. We introduce ReCite, an agentic reasoning system using autonomous tool calling and verification probes.",
    }

    is_grounded, reason, meta = research_radar.verify_content_match(
        url=genuine_item["canonical_url"],
        claimed_title=genuine_item["title"],
        topic_label=topic_label,
        topic_keywords=keywords,
        live_fetch=False,
        fetched_title=genuine_item["fetched_title"],
        fetched_text=genuine_item["fetched_text"],
    )

    assert is_grounded is True
    assert "Verified" in reason
    assert "agentic" in meta["matched_terms"]
    assert meta.get("quoted_excerpt") != ""
    assert meta.get("relevance_passed") is True


def test_relevance_verification_rejects_off_topic_alternate_senses_and_rhetorical_teasers():
    """
    Demonstrates that the upgraded relevance verification guard successfully catches and rejects:
    1. Item #12 (QMClaw): 'local-first' used in quantum measurement & control context without database backing.
    2. Item #14 (LoopCAT): 'local-first' used in computer-assisted translation education without database backing.
    3. Item #19 (Netlify Git): 'ai agent' mentioned as passing rhetorical interview teaser in Git infrastructure interview.
    """
    # 1. Item #12: QMClaw (Quantum control) tested against Edge database consistency
    item_12 = {
        "title": "QMClaw: A Scalable General-purpose Framework for Quantum Measurement and Control",
        "url": "https://arxiv.org/abs/2609.04674",
        "canonical_url": "https://arxiv.org/abs/2609.04674",
        "fetched_title": "QMClaw: A Scalable General-purpose Framework for Quantum Measurement and Control",
        "fetched_text": "Here we propose QMClaw, a general, workflow-oriented framework for QMC built, featuring a local-first, tool-governed, robust architecture for qubit calibration.",
    }
    is_g12, r12, m12 = research_radar.verify_content_match(
        url=item_12["canonical_url"],
        claimed_title=item_12["title"],
        topic_label="Edge database consistency",
        topic_keywords=["edge database", "local-first", "crdt", "eventual consistency", "sqlite edge"],
        live_fetch=False,
        fetched_title=item_12["fetched_title"],
        fetched_text=item_12["fetched_text"],
    )
    assert is_g12 is False
    assert "Topical relevance failed" in r12
    assert "quantum" in r12.lower()
    assert "local-first" in m12["quoted_excerpt"].lower()

    # 2. Item #14: LoopCAT (Translation education) tested against Edge database consistency
    item_14 = {
        "title": "From Tool Use to Technological Agency: LoopCAT as a Local-First, Open-Source Tool for Translation Technology Education",
        "url": "https://arxiv.org/abs/2609.00344",
        "canonical_url": "https://arxiv.org/abs/2609.00344",
        "fetched_title": "From Tool Use to Technological Agency: LoopCAT as a Local-First, Open-Source Tool for Translation Technology Education",
        "fetched_text": "This article presents LoopCAT, an Apache-2.0-licensed, local-first computer-assisted translation environment co-created with OpenAI Codex for teaching translation students.",
    }
    is_g14, r14, m14 = research_radar.verify_content_match(
        url=item_14["canonical_url"],
        claimed_title=item_14["title"],
        topic_label="Edge database consistency",
        topic_keywords=["edge database", "local-first", "crdt", "eventual consistency", "sqlite edge"],
        live_fetch=False,
        fetched_title=item_14["fetched_title"],
        fetched_text=item_14["fetched_text"],
    )
    assert is_g14 is False
    assert "Topical relevance failed" in r14
    assert "translation" in r14.lower()
    assert "local-first" in m14["quoted_excerpt"].lower()

    # 3. Item #19: Netlify Git Interview tested against AI agent tooling
    item_19 = {
        "title": "The full power of Git, without the friction: A conversation with Netlify CTO Dana Lawson",
        "url": "https://www.netlify.com/blog/netlify-source-with-netlify-cto-dana-lawson",
        "canonical_url": "https://www.netlify.com/blog/netlify-source-with-netlify-cto-dana-lawson",
        "fetched_title": "The full power of Git, without the friction: A conversation with Netlify CTO Dana Lawson",
        "fetched_text": "Netlify CTO Dana Lawson explains why Netlify brought Git infrastructure in-house, and what version control looks like in the age of AI agents.",
    }
    is_g19, r19, m19 = research_radar.verify_content_match(
        url=item_19["canonical_url"],
        claimed_title=item_19["title"],
        topic_label="AI agent tooling",
        topic_keywords=["ai agent", "agentic", "tool use", "mcp", "function calling"],
        live_fetch=False,
        fetched_title=item_19["fetched_title"],
        fetched_text=item_19["fetched_text"],
    )
    assert is_g19 is False
    assert "Topical relevance failed" in r19
    assert "git" in r19.lower()
    assert "ai agent" in m19["quoted_excerpt"].lower()


def test_relevance_verification_accepts_genuine_sources_with_quoted_excerpts():
    """
    Demonstrates that genuine sources pass relevance verification and produce verbatim quoted excerpts:
    1. Item #9 (Zeta-Lite): In-browser SQL database with MVCC and snapshot isolation.
    2. Item #16 (Cloudflare): Gateway MCP protocol heuristics and security enforcement.
    3. Item #17 (Netlify): Stateless MCP specification support for agent tooling.
    4. Item #18 (Netlify Drop): Factual agent deployment flow instructions.
    """
    # 1. Item #9: Zeta-Lite on Edge database consistency
    item_9 = {
        "title": "Zeta-Lite: A Concurrent, Branchable In-Browser SQL Database for Agentic Memory",
        "url": "https://arxiv.org/abs/2609.01818",
        "canonical_url": "https://arxiv.org/abs/2609.01818",
        "fetched_title": "Zeta-Lite: A Concurrent, Branchable In-Browser SQL Database for Agentic Memory",
        "fetched_text": "The browser has become a first-class database host: applications want to store and reason over structured data on the client for local-first collaboration. Zeta-lite keeps the engine's log-centric asynchronous MVCC core with snapshot-isolated transactions.",
    }
    is_g9, r9, m9 = research_radar.verify_content_match(
        url=item_9["canonical_url"],
        claimed_title=item_9["title"],
        topic_label="Edge database consistency",
        topic_keywords=["edge database", "local-first", "crdt", "eventual consistency", "sqlite edge"],
        live_fetch=False,
        fetched_title=item_9["fetched_title"],
        fetched_text=item_9["fetched_text"],
    )
    assert is_g9 is True
    assert m9["relevance_passed"] is True
    assert "local-first" in m9["quoted_excerpt"].lower()
    assert "database" in m9["quoted_excerpt"].lower() or "mvcc" in m9["quoted_excerpt"].lower()

    # 2. Item #16: Cloudflare MCP traffic security on AI agent tooling
    item_16 = {
        "title": "How Cloudflare detects MCP traffic and helps secure it",
        "url": "https://blog.cloudflare.com/mcp-security-updates/",
        "canonical_url": "https://blog.cloudflare.com/mcp-security-updates",
        "fetched_title": "How Cloudflare detects MCP traffic and helps secure it | Cloudflare Blog",
        "fetched_text": "Cloudflare Gateway identifies MCP requests using protocol-level heuristics. Security teams can use that signal to find shadow MCP traffic, enforce Portal-only access for approved servers, and block direct connections on managed network paths.",
    }
    is_g16, r16, m16 = research_radar.verify_content_match(
        url=item_16["canonical_url"],
        claimed_title=item_16["title"],
        topic_label="AI agent tooling",
        topic_keywords=["ai agent", "agentic", "tool use", "mcp", "function calling"],
        live_fetch=False,
        fetched_title=item_16["fetched_title"],
        fetched_text=item_16["fetched_text"],
    )
    assert is_g16 is True
    assert m16["relevance_passed"] is True
    assert "mcp" in m16["quoted_excerpt"].lower()

    # 3. Item #17: Netlify Stateless MCP on AI agent tooling
    item_17 = {
        "title": "MCP goes stateless and extensible",
        "url": "https://www.netlify.com/blog/mcp-goes-stateless-and-extensible",
        "canonical_url": "https://www.netlify.com/blog/mcp-goes-stateless-and-extensible",
        "fetched_title": "MCP goes stateless and extensible",
        "fetched_text": "The new stateless MCP spec makes building AI tools dramatically simpler. Learn how Netlify supports MCP 2026-07-28 today and why it matters for Agent Experience.",
    }
    is_g17, r17, m17 = research_radar.verify_content_match(
        url=item_17["canonical_url"],
        claimed_title=item_17["title"],
        topic_label="AI agent tooling",
        topic_keywords=["ai agent", "agentic", "tool use", "mcp", "function calling"],
        live_fetch=False,
        fetched_title=item_17["fetched_title"],
        fetched_text=item_17["fetched_text"],
    )
    assert is_g17 is True
    assert m17["relevance_passed"] is True
    assert "mcp" in m17["quoted_excerpt"].lower()

    # 4. Item #18: Netlify Drop on AI agent tooling
    item_18 = {
        "title": "The 13-year story of Netlify Drop",
        "url": "https://www.netlify.com/blog/thirteen-years-of-netlify-drop",
        "canonical_url": "https://www.netlify.com/blog/thirteen-years-of-netlify-drop",
        "fetched_title": "The 13-year story of Netlify Drop",
        "fetched_text": "Netlify Drop has offered anonymous drag-and-drop deploys since 2013 and pioneered the deploy-anonymously, claim-later flow AI agents use today. We now publish instructions for agents themselves at netlify.ai.",
    }
    is_g18, r18, m18 = research_radar.verify_content_match(
        url=item_18["canonical_url"],
        claimed_title=item_18["title"],
        topic_label="AI agent tooling",
        topic_keywords=["ai agent", "agentic", "tool use", "mcp", "function calling"],
        live_fetch=False,
        fetched_title=item_18["fetched_title"],
        fetched_text=item_18["fetched_text"],
    )
    assert is_g18 is True
    assert m18["relevance_passed"] is True
    assert "ai agent" in m18["quoted_excerpt"].lower()


def test_classifier_empirically_produces_mentioning_state():
    """
    Confirms that the competitor signal classifier empirically produces 'mentioning'
    results on real-world public communications without build/adopt evidence (e.g. opinion,
    spec commentary, or architectural advocacy).
    """
    topic = "AI agent tooling"
    kws = ["ai agent", "agentic", "tool use", "mcp", "function calling"]

    # Item #17: Netlify Stateless MCP specification blog post (thought leadership / spec commentary)
    sig_17 = {
        "source": "blog",
        "company": "Netlify",
        "title": "MCP goes stateless and extensible",
        "url": "https://www.netlify.com/blog/mcp-goes-stateless-and-extensible",
        "raw_excerpt": "The new stateless MCP spec makes building AI tools dramatically simpler. Learn how Netlify supports MCP 2026-07-28 today.",
        "quoted_excerpt": "The MCP 2026-07-28 specification makes the protocol stateless at its core, turning an MCP server into an ordinary HTTP workload. Building an MCP server becomes something almost any developer can do, rather than just teams experienced with running stateful infrastructure. Netlify has believed in this direction since MCP was first introduced and we have advocated for a stateless architecture from the beginning.",
    }
    state_17, reason_17, _ = research_radar.classify_competitor_signal(sig_17, topic, kws, verify_content=False)
    assert state_17 == "mentioning"
    assert "without build/adopt evidence" in reason_17

    # Perspective / thought-leadership essay without shipped capability
    sig_perspective = {
        "source": "blog",
        "company": "Fastly",
        "title": "Why WebAssembly matters for future frontend tools",
        "url": "https://fastly.com/blog/wasm-thoughts",
        "raw_excerpt": "Discussion from our developer relations team on how wasm could evolve over the next decade.",
    }
    st_persp, reason_persp, _ = research_radar.classify_competitor_signal(
        sig_perspective, "WASM at the edge", ["wasm", "webassembly"], verify_content=False
    )
    assert st_persp == "mentioning"
    assert "without build/adopt evidence" in reason_persp


def test_substance_based_classification_correctly_classifies_shipped_capability_in_blog_as_adopting():
    """
    Regression test for Item #18:
    Demonstrates that the classifier evaluates the SUBSTANCE of what is described rather than container format:
    - Item #18 was published in a blog post, but its excerpt describes an active, live product capability
      (publishing instructions for agents at netlify.ai for autonomous step-by-step deployment).
    - Under the substance-based rule, it correctly and verifiably lands in 'adopting'.
    - Uses strictly and only the actual verbatim excerpt describing the live netlify.ai capability.
    - Simultaneously confirms that Item #17 in the same container ('blog') correctly remains 'mentioning'.
    """
    topic = "AI agent tooling"
    kws = ["ai agent", "agentic", "tool use", "mcp", "function calling"]

    # Item #18: Netlify Drop post describing live netlify.ai agent deployment instructions
    sig_18 = {
        "source": "blog",  # Note container is 'blog'
        "company": "Netlify",
        "title": "The 13-year story of Netlify Drop",
        "url": "https://www.netlify.com/blog/thirteen-years-of-netlify-drop",
        "raw_excerpt": "Netlify Drop has offered anonymous drag-and-drop deploys since 2013 and pioneered the deploy-anonymously, claim-later flow AI agents use today.",
        "quoted_excerpt": "We now publish instructions for agents themselves at netlify.ai, which gives an agent step-by-step directions for deploying to Netlify and returning a live URL to its user.",
        "fetched_text": "We now publish instructions for agents themselves at netlify.ai, which gives an agent step-by-step directions for deploying to Netlify and returning a live URL to its user.",
    }

    state_18, reason_18, matched_kws_18 = research_radar.classify_competitor_signal(
        sig_18, topic, kws, verify_content=False
    )

    assert state_18 == "adopting", (
        f"Format-vs-substance failure: expected 'adopting' for live netlify.ai capabilities, got '{state_18}'"
    )
    assert "shipping/integrating" in reason_18 or "active live capability" in reason_18
    assert "ai agent" in matched_kws_18

    # Discrimination check: An opinion/advocacy post in the SAME container ('blog') remains 'mentioning'
    sig_17_opinion = {
        "source": "blog",
        "company": "Netlify",
        "title": "MCP goes stateless and extensible",
        "url": "https://www.netlify.com/blog/mcp-goes-stateless-and-extensible",
        "raw_excerpt": "Netlify has believed in this direction since MCP was first introduced and we have advocated for a stateless architecture from the beginning.",
    }
    state_17, _, _ = research_radar.classify_competitor_signal(
        sig_17_opinion, topic, kws, verify_content=False
    )
    assert state_17 == "mentioning"


def test_defensive_vs_adopting_distinction_and_item_16_item_18_classification():
    """
    Regression Test for Defensive-vs-Adopting Distinction:
    Resolves the adopting-vs-defensive conflation by proving:
    1. A company announcing blocking or restricting AI-agent traffic (adversarial/defensive stance)
       is NEVER classified as 'adopting' (correctly lands in 'mentioning' as defensive posture).
    2. Item #16 (Cloudflare MCP inspection): Cloudflare One detects shadow MCP traffic and inspects
       perimeter network connections to enforce enterprise firewall policies. Because it merely acts
       upon third-party network traffic rather than enabling, building for, or integrating MCP,
       it correctly lands in 'mentioning' (perimeter governance), NOT 'adopting'.
    3. Item #18 (Netlify netlify.ai): Netlify builds and operates deployment endpoints and live
       instructions for autonomous AI agents to deploy web applications and return live URLs.
       Because it actively enables and builds for the technology, it correctly lands in 'adopting'.
    """
    topic = "AI agent tooling"
    kws = ["ai agent", "agentic", "tool use", "mcp", "function calling"]

    # 1. Explicit Defensive / Adversarial Bot & Agent Blocking Test Case
    sig_blocking = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "Declaring your independence: block AI bots and scrapers with one click",
        "url": "https://blog.cloudflare.com/declaring-your-independence-block-ai-bots-and-scrapers-with-one-click",
        "raw_excerpt": "Cloudflare now blocks AI agent traffic by default to protect publishers from unauthorized crawling. Security teams can restrict, inspect, and control automated agent traffic across web properties.",
    }
    state_block, reason_block, _ = research_radar.classify_competitor_signal(
        sig_blocking, topic, kws, verify_content=False
    )
    assert state_block == "mentioning", f"Defensive blocking misclassified as '{state_block}' instead of 'mentioning'"
    assert "Defensive posture or perimeter traffic governance" in reason_block

    # 2. Item #16: Cloudflare MCP traffic inspection & gateway control (Perimeter Governance)
    sig_16 = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "How Cloudflare detects MCP traffic and helps secure it",
        "url": "https://blog.cloudflare.com/mcp-security-updates/",
        "raw_excerpt": "Cloudflare Gateway identifies MCP requests using protocol-level heuristics. Security teams can use that signal to find shadow MCP traffic.",
        "quoted_excerpt": "Today, we're announcing new Cloudflare One capabilities to identify inspected MCP traffic, show which users and servers are generating it, and control direct connections on managed network paths.",
        "fetched_text": "Today, we're announcing new Cloudflare One capabilities to identify inspected MCP traffic, show which users and servers are generating it, and control direct connections on managed network paths. Security teams can use that signal to find shadow MCP traffic.",
    }
    state_16, reason_16, matched_kws_16 = research_radar.classify_competitor_signal(
        sig_16, topic, kws, verify_content=False
    )
    # Under the refined rule, #16 does not build for or integrate MCP, so it is perimeter governance -> mentioning
    assert state_16 == "mentioning", f"Expected #16 to classify as 'mentioning' (perimeter governance), got '{state_16}'"
    assert "Defensive posture or perimeter traffic governance" in reason_16
    assert "mcp" in matched_kws_16

    # 3. Item #18: Netlify autonomous agent deployment instructions & endpoints (Active Adoption)
    sig_18 = {
        "source": "blog",
        "company": "Netlify",
        "title": "The 13-year story of Netlify Drop",
        "url": "https://www.netlify.com/blog/thirteen-years-of-netlify-drop",
        "raw_excerpt": "Netlify Drop has offered anonymous drag-and-drop deploys since 2013 and pioneered the deploy-anonymously, claim-later flow AI agents use today.",
        "quoted_excerpt": "We now publish instructions for agents themselves at netlify.ai, which gives an agent step-by-step directions for deploying to Netlify and returning a live URL to its user.",
        "fetched_text": "We now publish instructions for agents themselves at netlify.ai, which gives an agent step-by-step directions for deploying to Netlify and returning a live URL to its user.",
    }
    state_18, reason_18, matched_kws_18 = research_radar.classify_competitor_signal(
        sig_18, topic, kws, verify_content=False
    )
    assert state_18 == "adopting", f"Expected #18 to classify as 'adopting', got '{state_18}'"
    assert "shipping/integrating" in reason_18 or "active live capability" in reason_18
    assert "ai agent" in matched_kws_18


def test_held_out_generalization_on_real_live_fetched_data():
    """
    Held-out Generalization Test with REAL LIVE FETCHED EXCERPTS:
    Uses genuinely novel, independently-sourced excerpts fetched directly from live production
    URLs of competitors across multiple domains:

    1. Real Vercel Adoption (AI Agent Sandboxes):
       URL: https://vercel.com/changelog/run-cursor-cloud-agents-vercel-sandbox
       Text: "Run Cursor Cloud Agents on infrastructure you control with Vercel Sandbox, using scale-to-zero workers, isolated microVMs, and durable orchestration."
       Expected: 'adopting'

    2. Real Vercel Adoption (Agent Builder & MCP Connections):
       URL: https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard
       Text: "Build eve agents from the Vercel dashboard. The builder scaffolds the code, pushes it to your Git repo, and creates a Vercel project with AI Gateway models, web chat or Slack, and MCP connections."
       Expected: 'adopting'

    3. Real Cloudflare Bot Mitigation (Defensive / Gatekeeping):
       URL: https://blog.cloudflare.com/good-and-bad-agentic-behaviors/
       Text: "In this post, we'll share an inside look into the strategy of the Web Integrity & Trust team (covering the bots and fraud problem spaces) around detecting and analyzing good and bad behaviors, providing tools to help site owners tackle emerging challenges in the shifting Agentic Internet... starting with blocking malicious activity at the bottom, to encouraging participation in a safer Internet at the top."
       Expected: 'mentioning' (defensive gatekeeping, NOT adopting)

    4. Real Cloudflare Agents Week (True Multi-Product Agent Adoption):
       URL: https://blog.cloudflare.com/agents-week-review-august-2026/
       Text: "@cloudflare/computer introduces a new runtime, designed for agents, that can choose the right environment for the job... MCPv2 introduces the next evolution of MCP support, simplifying the deployment and scalability of agentic apps... WriteGuard: fine-grained controls for MCP Servers."
       Expected: 'adopting'
    """
    topic = "AI agent tooling"
    kws = ["ai agent", "agentic", "tool use", "mcp", "function calling", "cloud agent"]

    # 1. Real Vercel Cursor Cloud Agents in Sandbox
    sig_vercel_sandbox = {
        "source": "news",
        "company": "Vercel",
        "title": "Cursor Cloud Agents can now run in Vercel Sandbox - Vercel",
        "url": "https://vercel.com/changelog/run-cursor-cloud-agents-vercel-sandbox",
        "raw_excerpt": "Run Cursor Cloud Agents on infrastructure you control with Vercel Sandbox, using scale-to-zero workers, isolated microVMs, and durable orchestration.",
    }
    st_vs, r_vs, _ = research_radar.classify_competitor_signal(
        sig_vercel_sandbox, topic, kws, verify_content=False
    )
    assert st_vs == "adopting", f"Real Vercel Sandbox failed: expected 'adopting', got '{st_vs}'"

    # 2. Real Vercel Eve Agents & MCP Dashboard Deployment
    sig_vercel_eve = {
        "source": "news",
        "company": "Vercel",
        "title": "Build and deploy eve agents from the Vercel dashboard - Vercel",
        "url": "https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard",
        "raw_excerpt": "Build eve agents from the Vercel dashboard. The builder scaffolds the code, pushes it to your Git repo, and creates a Vercel project with AI Gateway models, web chat or Slack, and MCP connections.",
    }
    st_ve, r_ve, _ = research_radar.classify_competitor_signal(
        sig_vercel_eve, topic, kws, verify_content=False
    )
    assert st_ve == "adopting", f"Real Vercel Eve Agents failed: expected 'adopting', got '{st_ve}'"

    # 3. Real Cloudflare Bot Mitigation on Agentic Internet (Defensive Gatekeeping)
    sig_cf_mitigation = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "Unveiling good and bad behaviors on the Agentic Internet",
        "url": "https://blog.cloudflare.com/good-and-bad-agentic-behaviors/",
        "raw_excerpt": "In this post, we'll share an inside look into the strategy of the Web Integrity & Trust team (covering the bots and fraud problem spaces) around detecting and analyzing good and bad behaviors, providing tools to help site owners tackle emerging challenges in the shifting Agentic Internet... starting with blocking malicious activity at the bottom, to encouraging participation in a safer Internet at the top.",
    }
    st_cm, r_cm, _ = research_radar.classify_competitor_signal(
        sig_cf_mitigation, topic, kws, verify_content=False
    )
    assert st_cm == "mentioning", f"Real Cloudflare bot mitigation should be 'mentioning', got '{st_cm}'"
    assert "Defensive posture or perimeter traffic governance" in r_cm

    # 4. Real Cloudflare Agents Week True Platform Adoption
    sig_cf_agents_week = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "Everything we launched during Agents Week",
        "url": "https://blog.cloudflare.com/agents-week-review-august-2026/",
        "raw_excerpt": "@cloudflare/computer introduces a new runtime, designed for agents, that can choose the right environment for the job... MCPv2 introduces the next evolution of MCP support, simplifying the deployment and scalability of agentic apps... WriteGuard: fine-grained controls for MCP Servers.",
    }
    st_caw, r_caw, _ = research_radar.classify_competitor_signal(
        sig_cf_agents_week, topic, kws, verify_content=False
    )
    assert st_caw == "adopting", f"Real Cloudflare Agents Week failed: expected 'adopting', got '{st_caw}'"


def test_defensive_rule_generalization_on_real_and_novel_vocabulary():
    """
    Generalization test for the defensive/governance pattern rule:
    Verifies that DEFENSIVE_OR_GOVERNANCE_PATTERNS correctly catches differently-worded
    real and novel announcements (bot mitigation, robots.txt access control, rate-limiting, WAF rules)
    that do not share vocabulary with the original 'blocks AI agent traffic by default' test case.
    """
    topic = "AI agent tooling"
    kws = ["ai agent", "agentic", "tool use", "mcp", "agent", "crawler"]

    # 1. Real Cloudflare Announcement: Bot Preference Sync (robots.txt & disallow directives)
    # URL: https://blog.cloudflare.com/bot-preference-sync/
    sig_bot_pref_sync = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "Say it once: Introducing Bot Preference Sync",
        "url": "https://blog.cloudflare.com/bot-preference-sync/",
        "raw_excerpt": (
            "Cloudflare's new Bot Preference Sync automatically aligns your robots.txt file with your AI bot policies "
            "for Search, Agent, and Training. Easily manage which bots access your content without maintaining separate "
            "rules across multiple systems. Contents added by Bot Preference Sync will prepend Disallow directives."
        ),
    }
    state_bps, reason_bps, matched_bps = research_radar.classify_competitor_signal(
        sig_bot_pref_sync, topic, kws, verify_content=False
    )
    assert state_bps == "mentioning", f"Expected 'mentioning' for Bot Preference Sync, got '{state_bps}'"
    assert "Defensive posture or perimeter traffic governance" in reason_bps

    # 2. Real Cloudflare Announcement: Adaptive Intelligence (bot detection & automated abuse)
    # URL: https://blog.cloudflare.com/introducing-adaptive-intelligence/
    sig_adaptive_intel = {
        "source": "blog",
        "company": "Cloudflare",
        "title": "Introducing Adaptive Intelligence: Undermining the economics of every bot attack",
        "url": "https://blog.cloudflare.com/introducing-adaptive-intelligence/",
        "raw_excerpt": (
            "Today we are launching Adaptive Intelligence, a new bot detection engine that starts from the opposite idea. "
            "Cloudflare analyzes more than a trillion requests a day for signs of automated abuse from intelligent agents."
        ),
    }
    state_ai, reason_ai, matched_ai = research_radar.classify_competitor_signal(
        sig_adaptive_intel, topic, kws, verify_content=False
    )
    assert state_ai == "mentioning", f"Expected 'mentioning' for Adaptive Intelligence, got '{state_ai}'"
    assert "Defensive posture or perimeter traffic governance" in reason_ai

    # 3. Explicitly Labeled Synthetic Benchmark Fixture: Edge Rate-Limiting & Shielding APIs
    # [SYNTHETIC TEST FIXTURE] - Non-live benchmark fixture designed to stress-test orthogonal vocabulary
    sig_rate_limit = {
        "source": "news",
        "company": "Fastly",
        "title": "Edge Rate Limiting for Autonomous Crawlers and Agent Requests",
        "url": "test://synthetic-fixture/rate-limiting-autonomous-crawlers",
        "is_mock": True,
        "raw_excerpt": (
            "Enforce rate-limiting on incoming automated agent requests to shield origin APIs from overload. "
            "Security teams can now deploy edge WAF rules to filter out unauthorized crawlers and enforce access control for agents."
        ),
    }
    state_rl, reason_rl, matched_rl = research_radar.classify_competitor_signal(
        sig_rate_limit, topic, kws, verify_content=False
    )
    assert state_rl == "mentioning", f"Expected 'mentioning' for Rate Limiting & Shielding, got '{state_rl}'"
    assert "Defensive posture or perimeter traffic governance" in reason_rl

    # 4. Non-Defensive Platform Adoption Discrimination Check (Vercel Sandbox must still be adopting)
    sig_vercel_adopt = {
        "source": "news",
        "company": "Vercel",
        "title": "Cursor Cloud Agents can now run in Vercel Sandbox - Vercel",
        "url": "https://vercel.com/changelog/run-cursor-cloud-agents-vercel-sandbox",
        "raw_excerpt": "Run Cursor Cloud Agents on infrastructure you control with Vercel Sandbox, using scale-to-zero workers, isolated microVMs, and durable orchestration.",
    }
    state_va, reason_va, _ = research_radar.classify_competitor_signal(
        sig_vercel_adopt, topic, kws, verify_content=False
    )
    assert state_va == "adopting", f"Adoption signal misclassified: got '{state_va}'"






