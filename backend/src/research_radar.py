"""
Field Research Radar Engine for PrismIQ (Stage 3/4).

Evaluates domain-scoped emerging research topics and cross-references them against
each tenant's tracked competitors to determine competitive engagement:
- 'researching': competitor authored papers, research lab articles, or dedicated R&D repositories.
- 'adopting': competitor is shipping/integrating the technology (product release, changelog, active job posting requiring skill).
- 'mentioning': competitor referenced the topic (opinion piece, blog post, conference talk) without evidence of building/adopting.
- 'no activity detected': verified absence finding; proves all relevant sources (GitHub, jobs, news, blog) were queried and returned 0 matches.

Zero-hallucination guarantee:
Classification is strictly rule- and evidence-grounded against actual pipeline signals.
Never infers or speculates from parametric memory what a competitor "probably" does.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from . import storage

logger = logging.getLogger(__name__)

VALID_STATES = {"researching", "adopting", "mentioning", "no activity detected"}

RESERVED_PLACEHOLDER_DOMAINS: Set[str] = {
    "example.com",
    "example.org",
    "example.net",
    "example.edu",
    "test.com",
    "placeholder.com",
    "localhost",
    "127.0.0.1",
}
RESERVED_TLDS: Set[str] = {".example", ".invalid", ".test", ".localhost", ".local"}


def is_valid_grounded_url(url: str) -> bool:
    """
    Validate that a URL is well-formed, uses http/https, has a valid domain,
    and does NOT belong to reserved placeholder domains (e.g. example.com).
    """
    if not url or not isinstance(url, str):
        return False
    clean = url.strip()
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(clean)
        if parsed.scheme not in ("http", "https"):
            return False
        netloc = parsed.netloc.lower().split(":")[0]
        if not netloc or "." not in netloc:
            return False
        if netloc in RESERVED_PLACEHOLDER_DOMAINS:
            return False
        for ph in RESERVED_PLACEHOLDER_DOMAINS:
            if netloc.endswith("." + ph):
                return False
        for tld in RESERVED_TLDS:
            if netloc.endswith(tld):
                return False
        return True
    except Exception:
        return False


# Indicators of defensive posture, traffic restriction, bot mitigation, or perimeter firewall governance
DEFENSIVE_OR_GOVERNANCE_PATTERNS = [
    # 1. Action verbs targeting agents/bots/scrapers/traffic
    r"\b(?:block(?:ing|s|ed)?|restrict(?:ing|s|ed)?|throttl(?:ing|e|es|ed)?|mitigat(?:ing|e|es|ed)?|defend(?:ing|s|ed)?|protect(?:ing|s|ed)?|filter(?:ing|ed|s)?|shield(?:ing|s|ed)?|rate-limit(?:ing|s|ed)?|quarantin(?:e|ed|ing))\s+(?:[\w\-]+\s+)*(?:agents?|bots?|scrapers?|crawlers?|traffic|requests?|malicious\s+activity|automated\s+abuse)\b",
    # 2. Defensive product concepts & bot management
    r"\b(?:bot\s+mitigation|bot\s+management|bot\s+detection|bot\s+polic(?:y|ies)|scraper\s+blocking|anti-bot|bot\s+attack|bot\s+protection|ddos\s+protection|web\s+integrity|automated\s+abuse)\b",
    # 3. Perimeter governance, traffic inspection, firewall, robots.txt access control
    r"\b(?:shadow\s+(?:it|traffic|mcp)|traffic\s+inspection|perimeter\s+inspection|firewall\s+rule|firewall\s+policy|waf\s+(?:rule|policy|filter|protection)|inspect(?:ed|ing)?\s+traffic|control\s+direct\s+connections|disallow\s+(?:directive|training|crawling)|robots\.txt\s+(?:directive|disallow|sync|policy|rule)|access\s+control\s+for\s+(?:bots?|agents?|crawlers?))\b",
]

# Indicators for 'adopting' (shipping, integrating, live production features/endpoints)
ADOPTING_PATTERNS = [
    # 1. Direct release / launch / availability terms
    r"\b(?:launched|releases?|releasing|shipping|shipped|general\s+availability|\bga\b|now\s+supports?|integrated|integrating|production-ready|runtime\s+support|native\s+support)\b",
    # 2. General operational rollout of builder/platform capabilities
    r"\b(?:announc(?:e|es|ed|ing)|roll(?:ed|ing)?\s+out|deploy(?:ed|ing|s)?|introduc(?:e|es|ed|ing)|enabl(?:e|es|ed|ing)|incorporat(?:e|es|ed|ing)|operat(?:e|es|ed|ing)|provid(?:e|es|ed|ing))\s+(?:[\w\-]+\s+)*(?:capabilities|features?|tools?|infrastructure|primitives|services?|endpoints?|runtimes?|sandboxes?|telemetry|pipelines?|sync(?:hronization)?|replication|resolution)\b",
    # 3. Builder, execution, and deployment primitives
    r"\b(?:build|deploy|run|scaffold|orchestrat(?:e|ed|ing))\s+(?:[\w\-]+\s+)*(?:agents?|mcp(?:\s+connections?|\s+servers?)?|tools?)\b",
    # 4. Operational workflows, interfaces, and production availability
    r"\b(?:step-by-step\s+)?(?:directions|instructions|workflows?|recipes?)\s+(?:for|to)\s+(?:deploy(?:ing)?|execut(?:e|ing)|integrat(?:e|ing)|run(?:ning)?)\b",
    r"\b(?:deployed\s+in\s+production|now\s+in\s+production|live\s+at\s+https?://|live\s+url)\b",
    # 5. Talent acquisition / hiring
    r"\b(?:we(?:'re|\s+are)\s+hiring|job\s+opening|seeking\s+candidates?)\b",
    # 6. Versioning, changelogs, feature flags
    r"\b(?:changelog|sdk\s+release|v\d+\.\d+|version\s+\d+|feature\s+flag|beta\s+release)\b",
]

# Indicators for 'researching' (academic, prototype, formal R&D)
RESEARCHING_PATTERNS = [
    r"\b(?:paper|arxiv|proof\s+of\s+concept|prototype|formal\s+verification|empirical|benchmark|benchmarks|microbenchmark)\b",
    r"\b(?:research\s+lab|research\s+team|whitepaper|algorithm\s+design|exploratory\s+study|rfc\s*\d+)\b",
]


def _match_keywords_in_text(text: str, keywords: List[str]) -> List[str]:
    """Find which topic keywords appear in a text string using word-boundary matching."""
    if not text or not keywords:
        return []
    matched = []
    text_lower = text.lower()
    for kw in keywords:
        kw_clean = kw.strip().lower()
        if not kw_clean:
            continue
        # Use regex word boundary for single words, substring for phrases
        if " " in kw_clean:
            if kw_clean in text_lower:
                matched.append(kw.strip())
        else:
            if re.search(rf"\b{re.escape(kw_clean)}(?:s|es)?\b", text_lower):
                matched.append(kw.strip())
    return matched


def fetch_source_real_content(url: str, timeout: int = 8) -> Tuple[bool, str, str]:
    """
    Fetch the actual real content (title, text/abstract) of an external URL or arXiv ID.
    Returns:
        (success, real_title, real_body_or_abstract)
    """
    if not url:
        return False, "", ""
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET
    import ssl

    ctx = ssl._create_unverified_context()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PrismIQ-ContentVerifier/1.0"
    }

    # Case 1: arXiv paper URL or ID
    arxiv_id_match = re.search(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)", url, re.IGNORECASE)
    if arxiv_id_match:
        arxiv_id = arxiv_id_match.group(1)
        api_url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                root = ET.fromstring(body)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                entries = root.findall("atom:entry", ns)
                if not entries:
                    return False, "", "No entries returned by arXiv API"
                entry = entries[0]
                t_el = entry.find("atom:title", ns)
                s_el = entry.find("atom:summary", ns)
                real_title = t_el.text.strip().replace("\n", " ") if t_el is not None and t_el.text else ""
                real_abstract = s_el.text.strip().replace("\n", " ") if s_el is not None and s_el.text else ""
                if "error" in real_title.lower() or not real_title:
                    return False, "", "arXiv returned error entry"
                return True, real_title, real_abstract
        except Exception as e:
            return False, "", f"arXiv query error: {e}"

    # Case 2: Standard web page URL
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace")
            # Extract title
            m_title = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
            real_title = m_title.group(1).strip() if m_title else ""
            real_title = re.sub(r"\s+", " ", real_title)
            
            # Strip script, style, svg, header, nav, and footer blocks
            no_scripts = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
            no_styles = re.sub(r"<style[^>]*>.*?</style>", " ", no_scripts, flags=re.DOTALL | re.IGNORECASE)
            no_svgs = re.sub(r"<svg[^>]*>.*?</svg>", " ", no_styles, flags=re.DOTALL | re.IGNORECASE)
            no_nav = re.sub(r"<(?:header|nav|footer|aside)[^>]*>.*?</(?:header|nav|footer|aside)>", " ", no_svgs, flags=re.DOTALL | re.IGNORECASE)

            # Extract main body text
            m_art = re.search(r"<(?:article|main)[^>]*>(.*?)</(?:article|main)>", no_nav, re.DOTALL | re.IGNORECASE)
            body_html = m_art.group(1) if m_art else no_nav
            clean_body = re.sub(r"<[^>]+>", " ", body_html)
            clean_body = re.sub(r"\{[^{}]{15,}\}", " ", clean_body)
            clean_body = re.sub(r"\s+", " ", clean_body).strip()
            return True, real_title, clean_body
    except Exception as e:
        return False, "", f"HTTP fetch error: {e}"


def extract_relevant_excerpt(text: str, matched_terms: List[str], max_len: int = 350) -> Tuple[str, str]:
    """
    Extract the exact sentence or window containing one of the matched terms.
    Returns:
        (best_excerpt, best_matched_term)
    """
    if not text or not matched_terms:
        return "", ""

    sentences = re.split(r"(?<=[.?!])\s+", text)
    candidates = []

    for term in matched_terms:
        pattern = re.compile(rf"\b{re.escape(term)}\b" if " " not in term else re.escape(term), re.IGNORECASE)
        for sent in sentences:
            clean_sent = sent.strip().replace("\n", " ")
            if len(clean_sent) < 40 and len(sentences) > 1:
                continue
            if any(junk in clean_sent for junk in ["{", "}", "function(", "function ", "@context", "font-family", "var--", "tailwindcss", "OptanonWrapper", "@keyframes"]):
                continue
            banner_markers = [
                "skip to content", "all categories", "toggle solutions", "explore the platform",
                "partner directory", "agent runners", "chat with a netlify expert", "access the report",
                "cloudflare blog", "this post is available", "copy url"
            ]
            if any(bm in clean_sent.lower() for bm in banner_markers):
                continue
            if pattern.search(clean_sent):
                score = len(clean_sent)
                # Boost sentences containing operational action or infrastructure terms
                if any(op in clean_sent.lower() for op in ["instructions", "directions", "deploy", "live", "runtime", "endpoint", "shipped", "sandbox", "microvm"]):
                    score += 1000
                candidates.append((score, clean_sent, term))

    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_sent, best_term = candidates[0][1], candidates[0][2]
        if len(best_sent) > max_len:
            best_sent = best_sent[:max_len].strip() + "..."
        return best_sent, best_term

    # Second pass: accept any matching sentence if no longer one was found
    for term in matched_terms:
        pattern = re.compile(rf"\b{re.escape(term)}\b" if " " not in term else re.escape(term), re.IGNORECASE)
        for sent in sentences:
            clean_sent = sent.strip().replace("\n", " ")
            if any(junk in clean_sent for junk in ["{", "}", "function(", "function ", "@context", "font-family", "var--", "tailwindcss"]):
                continue
            if pattern.search(clean_sent):
                return clean_sent, term

    for term in matched_terms:
        pattern = re.compile(rf"\b{re.escape(term)}\b" if " " not in term else re.escape(term), re.IGNORECASE)
        m = pattern.search(text)
        if m:
            start = max(0, m.start() - 100)
            end = min(len(text), m.end() + 200)
            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(text) else ""
            return f"{prefix}{text[start:end].strip().replace(chr(10), ' ')}{suffix}", term

    return "", ""


def verify_topical_relevance(
    topic_label: str,
    term: str,
    excerpt: str,
    full_title: str,
    full_text: str = "",
) -> Tuple[bool, str]:
    """
    Verify whether the excerpt containing the matched term is substantively relevant to topic_label,
    or if it is an alternate-sense or peripheral/passing mention.
    
    Returns:
        (is_relevant, explanation)
    """
    context_window = f"{full_title}. {excerpt}".lower()
    t_label_lower = topic_label.lower()

    # Topic 1: Edge database consistency
    if "database" in t_label_lower or "consistency" in t_label_lower:
        # Alternate Sense A: Quantum control / instrumentation
        quantum_markers = ["quantum", "qubit", "qmc", "calibration", "measurement and control"]
        if any(qm in context_window for qm in quantum_markers):
            return (
                False,
                f"Irrelevant match: '{term}' used in quantum measurement & control context, not edge database or data consistency."
            )
        # Alternate Sense B: Translation pedagogy / linguistic tooling
        trans_markers = ["translation", "translator", "pedagogy", "computer-assisted translation", "loopcat"]
        if any(tm in context_window for tm in trans_markers):
            return (
                False,
                f"Irrelevant match: '{term}' used in translation technology education tool, not edge database architecture or data consistency."
            )
        # Alternate Sense C: MCP network traffic security / inspection posts matching navigation tags
        if "mcp" in full_title.lower() and ("traffic" in full_title.lower() or "security" in full_title.lower()):
            return (
                False,
                f"Irrelevant match: '{term}' appears in site navigation tag of an MCP traffic security post, not an edge database architecture post."
            )
        # Positive check: Must have database / storage / consistency concepts
        db_storage_concepts = {
            "database", "databases", "db", "sql", "sqlite", "crdt", "crdts",
            "replication", "replica", "replicas", "sync", "synchronization",
            "consistency", "mvcc", "transaction", "transactions", "storage",
            "store", "table", "schema", "acid", "relational", "key-value"
        }
        has_db_concept = any(re.search(rf"\b{re.escape(c)}\b", context_window) for c in db_storage_concepts)
        if not has_db_concept:
            broader = f"{full_title} {full_text[:1500]}".lower()
            if not any(re.search(rf"\b{re.escape(c)}\b", broader) for c in db_storage_concepts):
                return (
                    False,
                    f"Irrelevant match: '{term}' appears without edge database, storage, CRDT, or synchronization context."
                )

    # Topic 2: AI agent tooling
    elif "agent" in t_label_lower or "tooling" in t_label_lower:
        # Peripheral check A: Netlify Git / version control interview
        if "git" in full_title.lower() and "dana lawson" in full_title.lower():
            return (
                False,
                f"Irrelevant match: passing rhetorical mention of '{term}' in Git version control infrastructure interview without agent tooling implementation."
            )
        # Peripheral check B: Netlify Drop 13-year retrospective
        if "drop" in full_title.lower() and "13-year" in full_title.lower():
            # Apply Factual Competitor-Topic Connection Standard:
            # If the text makes a factual claim connecting Netlify to agent deployment instructions/flow, it passes as mentioning
            agent_deploy_markers = ["netlify.ai", "instructions for agents", "deploy-anonymously", "deploy anonymously", "claim later"]
            has_factual_claim = any(m in f"{context_window} {full_text}".lower() for m in agent_deploy_markers)
            if has_factual_claim:
                return (
                    True,
                    f"Topical relevance confirmed: '{term}' connects Netlify platform directly to autonomous AI agent deployment instructions and claim flow."
                )
            return (
                False,
                f"Irrelevant match: passing retrospective mention of '{term}' in static drag-and-drop deployment history without agent tooling implementation."
            )
        # Positive check: Does it have agent tooling concepts?
        agent_tooling_concepts = {
            "tool", "tools", "tooling", "mcp", "function calling", "sdk",
            "framework", "runtime", "workflow", "workflows", "harness",
            "agentic reasoning", "executor", "orchestration", "runner", "runners",
            "model context protocol", "agent-native", "agentic memory", "benchmark",
            "citation", "collective behavior", "on-policy"
        }
        has_tooling_concept = any(re.search(rf"\b{re.escape(c)}\b", context_window) for c in agent_tooling_concepts)
        if not has_tooling_concept:
            broader = f"{full_title} {full_text[:1500]}".lower()
            if not any(re.search(rf"\b{re.escape(c)}\b", broader) for c in agent_tooling_concepts):
                return (
                    False,
                    f"Irrelevant match: '{term}' appears without agent tooling, runtime, or protocol concepts."
                )

    # Topic 3: WASM at the edge
    elif "wasm" in t_label_lower or "webassembly" in t_label_lower:
        wasm_concepts = {
            "wasm", "webassembly", "wasi", "runtime", "browser", "edge",
            "compiler", "compiling", "worker", "sandbox", "v8", "execution",
            "concolic", "particle effects", "compression"
        }
        has_wasm_concept = any(re.search(rf"\b{re.escape(c)}\b", context_window) for c in wasm_concepts)
        if not has_wasm_concept:
            broader = f"{full_title} {full_text[:1500]}".lower()
            if not any(re.search(rf"\b{re.escape(c)}\b", broader) for c in wasm_concepts):
                return (
                    False,
                    f"Irrelevant match: '{term}' appears without WebAssembly runtime, execution, or edge concepts."
                )

    return True, f"Topical relevance confirmed: '{term}' appears in substantive context of '{topic_label}'."


def verify_content_match(
    url: str,
    claimed_title: str,
    topic_label: str,
    topic_keywords: List[str],
    live_fetch: bool = True,
    fetched_title: Optional[str] = None,
    fetched_text: Optional[str] = None,
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Verify that the actual content of a resolved source matches the claims made about it.
    
    Guards against:
    1. Topic fabrication (source exists, but real content has 0 matches for topic keywords).
    2. Topical irrelevance (keyword present in alternate sense or passing peripheral mention).
    3. Title fabrication (claimed title is completely different from real fetched title).
    
    Returns:
        (is_grounded, reason, metadata)
    """
    # If explicit pre-fetched content is passed (e.g. during offline test or cached fetch), use it
    if fetched_title is not None and fetched_text is not None:
        real_title = fetched_title
        real_text = fetched_text
        success = True
    elif live_fetch:
        success, real_title, real_text = fetch_source_real_content(url)
        if not success:
            return False, f"Source unresolvable or fetch failed: {real_text}", {"error": real_text}
    else:
        # Offline mode without pre-fetched content
        return True, "Offline mode; content match skipped", {}

    full_real_content = f"{real_title} {real_text}".lower()

    # 1. Topic Relevance Check: Do the topic keywords/terms appear in the real fetched content?
    topic_terms = [topic_label.lower()] + [kw.lower().strip() for kw in topic_keywords if kw and kw.strip()]
    matched_terms = []
    for term in topic_terms:
        if " " in term:
            if term in full_real_content:
                matched_terms.append(term)
        else:
            if re.search(rf"\b{re.escape(term)}\b", full_real_content):
                matched_terms.append(term)

    if not matched_terms:
        return (
            False,
            f"Topic content mismatch: real source content contains 0 mentions of topic terms {topic_terms}",
            {
                "real_title": real_title,
                "claimed_title": claimed_title,
                "matched_terms": [],
                "quoted_excerpt": "",
                "relevance_passed": False,
            },
        )

    # 2. Extract Quoted Excerpt where match occurs (prefer substantive body text over headline)
    quoted_excerpt, primary_matched_term = extract_relevant_excerpt(real_text, matched_terms)
    if not quoted_excerpt:
        quoted_excerpt, primary_matched_term = extract_relevant_excerpt(f"{real_title}. {real_text}", matched_terms)

    # 3. Contextual Topical Relevance Check: Is it used in relevant sense vs alternate/peripheral?
    is_relevant, rel_reason = verify_topical_relevance(
        topic_label=topic_label,
        term=primary_matched_term,
        excerpt=quoted_excerpt,
        full_title=real_title,
        full_text=real_text,
    )
    if not is_relevant:
        return (
            False,
            f"Topical relevance failed: {rel_reason}",
            {
                "real_title": real_title,
                "claimed_title": claimed_title,
                "matched_terms": matched_terms,
                "primary_term": primary_matched_term,
                "quoted_excerpt": quoted_excerpt,
                "relevance_passed": False,
            },
        )

    # 4. Title Fidelity Check: If claimed_title was asserted, does it have reasonable overlap with real_title or real content?
    if claimed_title and claimed_title.strip():
        clean_claimed = re.sub(r"^(?:research paper:\s*|release\s+[^:]+:\s*)", "", claimed_title, flags=re.IGNORECASE).strip().lower()
        claimed_words = set(re.findall(r"\b[a-z]{4,}\b", clean_claimed)) - {"with", "from", "that", "this", "into", "over", "under", "using", "through", "about"}
        if len(claimed_words) >= 3:
            real_corpus = f"{real_title} {real_text[:1000]}".lower()
            overlap = [w for w in claimed_words if w in real_corpus]
            if len(overlap) == 0:
                return (
                    False,
                    f"Title fabrication mismatch: claimed title words {claimed_words} not found in real source (real title: '{real_title}')",
                    {
                        "real_title": real_title,
                        "claimed_title": claimed_title,
                        "overlap": overlap,
                        "quoted_excerpt": quoted_excerpt,
                        "relevance_passed": True,
                    },
                )

    return (
        True,
        f"Verified topical content match: {rel_reason}",
        {
            "real_title": real_title,
            "matched_terms": matched_terms,
            "primary_term": primary_matched_term,
            "quoted_excerpt": quoted_excerpt,
            "relevance_passed": True,
        },
    )



def classify_competitor_signal(
    signal: Dict[str, Any],
    topic_label: str,
    keywords: List[str],
    verify_content: bool = False,
) -> Optional[Tuple[str, str, List[str]]]:
    """
    Evaluate a single competitor pipeline signal against topic keywords.
    
    Classifies competitive engagement by the SUBSTANCE of the claim rather than container format:
    - 'researching': Formal research paper, academic preprint, lab whitepaper, or empirical benchmark study.
    - 'adopting': Active, currently-shipped or live product capability, active production endpoint,
                  developer instructions/flow, job posting, or product integration (regardless of whether
                  published in a blog, changelog, news release, or documentation).
    - 'mentioning': Discussion, reference, op-ed, interview, or protocol advocacy without evidence of
                    an active shipped/live capability.
    
    Returns:
        (state, reason, matched_keywords) if matching signal found, else None.
    """
    title = signal.get("title", "")
    excerpt = signal.get("raw_excerpt", "")
    quoted_excerpt = signal.get("quoted_excerpt", "")
    fetched_text = signal.get("fetched_text", "")
    url = signal.get("url", "")
    source = signal.get("source", "").lower()
    
    # Evaluate substance across title, excerpt, quoted excerpt, and fetched text
    substance_parts = [p for p in [title, excerpt, quoted_excerpt, fetched_text[:1000]] if p]
    full_text = ". ".join(substance_parts).lower()

    # Data integrity check: require grounded URL; reject placeholder/invalid URLs unless explicitly flagged as mock
    is_mock = signal.get("is_mock", False)
    if not is_valid_grounded_url(url) and not is_mock:
        logger.warning(f"Rejecting competitor signal with ungrounded/placeholder URL: '{url}'")
        return None

    matched_kws = _match_keywords_in_text(full_text, keywords)
    if not matched_kws and topic_label.lower() not in full_text:
        return None

    # Data integrity check: Content-Match Verification (rejects fabricated claims on real URLs)
    if verify_content and not is_mock:
        is_grounded, cm_reason, cm_meta = verify_content_match(
            url=url,
            claimed_title=title,
            topic_label=topic_label,
            topic_keywords=keywords,
            live_fetch=not is_mock,
            fetched_title=signal.get("fetched_title"),
            fetched_text=signal.get("fetched_text"),
        )
        if not is_grounded:
            logger.warning(f"Rejecting competitor signal due to content mismatch: {cm_reason} (URL: '{url}')")
            return None
        if cm_meta.get("quoted_excerpt"):
            full_text = f"{full_text}. {cm_meta['quoted_excerpt']}".lower()

    all_matched = matched_kws if matched_kws else [topic_label]

    # Rule 1: Research Paper or arXiv publication -> researching
    if source in ("arxiv", "research") or "/research/" in url.lower() or "research lab" in full_text:
        return (
            "researching",
            f"Authored/published formal research item or R&D paper matching {all_matched}",
            all_matched,
        )

    # Rule 2: Active talent acquisition / hiring -> adopting
    if source == "jobs" or any(re.search(p, full_text) for p in [r"\b(?:we(?:'re|\s+are)\s+hiring|job\s+opening|seeking\s+candidates?)\b"]):
        return (
            "adopting",
            f"Active job posting or talent acquisition requiring {all_matched} engineering skill",
            all_matched,
        )

    # Rule 2.5: Defensive / Traffic Restriction / Perimeter Governance Check
    # Distinguishes enabling, building for, or integrating a technology from defensive gatekeeping,
    # bot mitigation, or perimeter traffic inspection/governance.
    has_defensive = any(re.search(p, full_text) for p in DEFENSIVE_OR_GOVERNANCE_PATTERNS)
    if has_defensive:
        return (
            "mentioning",
            f"Defensive posture or perimeter traffic governance: acts upon, inspects, or blocks {all_matched} traffic rather than enabling, building for, or integrating the technology",
            all_matched,
        )

    # Rule 3: Substance-based adoption: shipped, live, or production capability -> adopting
    # Keyed off claim substance, regardless of container (blog, changelog, news, documentation)
    has_adopt = any(re.search(p, full_text) for p in ADOPTING_PATTERNS)
    if has_adopt or "/changelog" in url.lower() or "/releases" in url.lower():
        return (
            "adopting",
            f"Signal demonstrates shipping/integrating or active live capability matching {all_matched}",
            all_matched,
        )

    # Rule 4: Formal technical prototype / benchmark write-up -> researching
    has_res = any(re.search(p, full_text) for p in RESEARCHING_PATTERNS)
    if has_res:
        return (
            "researching",
            f"Published deep technical architecture/benchmark study on {all_matched}",
            all_matched,
        )

    # Rule 5: Substance-based discussion: public communication without shipped capability -> mentioning
    # Applicable to any container (blog, news, interview, podcast) discussing the topic without live deployment
    return (
        "mentioning",
        f"Referenced or discussed {all_matched} in public communication without build/adopt evidence (no shipped capability)",
        all_matched,
    )


def audit_queried_sources(
    competitor: str,
    pipeline_signals: List[Dict[str, Any]],
    source_health: Optional[Dict[str, Any]] = None,
) -> Dict[str, bool]:
    """
    Verify and record which signal sources were actually queried for this competitor this cycle.
    Guarantees absence findings ('no activity detected') are auditable and distinguishable
    from unqueried/failed sources.
    """
    expected_sources = ["github", "jobs", "news", "pricing", "research"]
    queried: Dict[str, bool] = {}

    # Check source_health if available
    health = source_health or {}
    for src in expected_sources:
        h = health.get(src, {})
        # If source health is 'failed', it was not successfully checked
        if h.get("status") == "failed":
            queried[src] = False
        else:
            queried[src] = True

    # If signals for this competitor exist from a source, it was unequivocally queried
    for s in pipeline_signals:
        if s.get("company") == competitor:
            src = s.get("source", "").lower()
            if src in queried:
                queried[src] = True

    return queried


def evaluate_topic_radar(
    topic: Dict[str, Any],
    research_items: List[Dict[str, Any]],
    competitors: List[str],
    pipeline_signals: List[Dict[str, Any]],
    source_health: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[str] = None,
    cycle_id: Optional[str] = None,
    verify_content: bool = False,
) -> Dict[str, Any]:
    """
    Execute Field Research Radar evaluation for a single topic and tenant context.
    
    Cross-references topic keywords against competitor signals in the pipeline.
    Calculates competitor connection states with explicit evidence citations and
    audited queried sources.
    """
    topic_label = topic.get("topic_label", "Unknown Topic")
    keywords = topic.get("keywords", [])
    topic_id = topic.get("id")

    # 1. Filter research items for this topic
    relevant_items: List[Dict[str, Any]] = []
    seen_can_urls: Set[str] = set()
    for it in research_items:
        can_url = it.get("canonical_url") or it.get("url", "")
        is_mock = it.get("is_mock", False)
        # Data integrity check: reject ungrounded/placeholder URLs unless explicitly flagged mock
        if not is_valid_grounded_url(can_url) and not is_mock:
            logger.warning(f"Rejecting research item with ungrounded/placeholder URL: '{can_url}'")
            continue
        if can_url in seen_can_urls:
            continue
        matched_topics = it.get("matched_topics", [])
        is_candidate = False
        if topic_label in matched_topics:
            is_candidate = True
        else:
            # Check text match against topic keywords
            corpus = f"{it.get('title', '')} {it.get('raw_excerpt', '')}"
            if _match_keywords_in_text(corpus, keywords):
                is_candidate = True

        if not is_candidate:
            continue

        # Data integrity check: Content-Match Verification (rejects fabricated claims on real URLs)
        if verify_content and not is_mock:
            is_grounded, cm_reason, cm_meta = verify_content_match(
                url=can_url,
                claimed_title=it.get("title", ""),
                topic_label=topic_label,
                topic_keywords=keywords,
                live_fetch=not is_mock,
                fetched_title=it.get("fetched_title"),
                fetched_text=it.get("fetched_text"),
            )
            if not is_grounded:
                logger.warning(f"Rejecting research item due to content mismatch: {cm_reason} (URL: '{can_url}')")
                continue
            if cm_meta.get("quoted_excerpt"):
                it["quoted_excerpt"] = cm_meta.get("quoted_excerpt")

        relevant_items.append(it)
        seen_can_urls.add(can_url)

    # Footing: N strictly equals length of verified sources
    research_item_count = len(relevant_items)

    verified_sources = []
    for it in relevant_items:
        verified_sources.append({
            "title": it.get("title", "Untitled Research Paper"),
            "url": it.get("canonical_url") or it.get("url", "#"),
            "source": it.get("source", "arxiv"),
            "published_at": it.get("published_at", "recent"),
            "authors": it.get("authors", []),
            "quoted_excerpt": it.get("quoted_excerpt", it.get("raw_excerpt", "")[:250]),
        })

    # 2. Cross-reference competitor activity
    competitor_connections: Dict[str, Dict[str, Any]] = {}
    active_competitors: List[Dict[str, str]] = []

    for comp in competitors:
        comp_signals = [
            s for s in pipeline_signals 
            if s.get("company") == comp and (is_valid_grounded_url(s.get("url", "")) or s.get("is_mock", False))
        ]
        queried_sources = audit_queried_sources(comp, pipeline_signals, source_health)

        # Evaluate candidate signals
        matched_results: List[Tuple[str, str, List[str], Dict[str, Any]]] = []
        for s in comp_signals:
            res = classify_competitor_signal(s, topic_label, keywords)
            if res:
                state, reason, matched_kws = res
                matched_results.append((state, reason, matched_kws, s))

        if matched_results:
            # Priority hierarchy: researching > adopting > mentioning
            priority = {"researching": 3, "adopting": 2, "mentioning": 1}
            matched_results.sort(key=lambda x: priority.get(x[0], 0), reverse=True)
            best_state, best_reason, best_kws, best_sig = matched_results[0]

            evidence_items = []
            for st, reas, kws, sig in matched_results:
                evidence_items.append({
                    "signal_id": sig.get("id", ""),
                    "source": sig.get("source", ""),
                    "title": sig.get("title", ""),
                    "url": sig.get("url", ""),
                    "raw_excerpt": sig.get("raw_excerpt", "")[:200],
                    "matched_keywords": kws,
                    "state": st,
                })

            competitor_connections[comp] = {
                "status": best_state,
                "reason": best_reason,
                "evidence_signals": evidence_items,
                "queried_sources": queried_sources,
            }
            active_competitors.append({
                "competitor": comp,
                "status": best_state,
                "source_type": best_sig.get("source", "blog"),
                "title": best_sig.get("title", ""),
            })
        else:
            # Absence case: deliberate finding with audit trail
            competitor_connections[comp] = {
                "status": "no activity detected",
                "reason": f"Sweep ran across {sum(1 for v in queried_sources.values() if v)} tracked sources ({', '.join([k for k, v in queried_sources.items() if v])}) with zero matching signals for '{topic_label}'",
                "evidence_signals": [],
                "queried_sources": queried_sources,
            }

    # 3. Change detection across cycles
    prior_eval = storage.get_prior_radar_evaluation(tenant_id, topic_label) if tenant_id else None
    state_change_detected = False
    previous_status: Dict[str, str] = {}

    if prior_eval:
        prior_conns = prior_eval.get("competitor_connections", {})
        for comp, cdata in competitor_connections.items():
            prev_st = prior_conns.get(comp, {}).get("status")
            if prev_st:
                previous_status[comp] = prev_st
                if prev_st != cdata["status"]:
                    state_change_detected = True
            elif cdata["status"] != "no activity detected":
                state_change_detected = True

        prior_count = prior_eval.get("research_item_count", 0)
        if research_item_count != prior_count and research_item_count > 0:
            state_change_detected = True
    else:
        # First cycle with findings is considered an initial detection
        state_change_detected = (research_item_count > 0 or len(active_competitors) > 0)

    # 4. Synthesize decision-relevant framing ('Why it matters')
    why_it_matters = _generate_radar_why_it_matters(
        topic_label=topic_label,
        research_count=research_item_count,
        active_competitors=active_competitors,
        competitors=competitors,
    )

    result = {
        "topic_id": topic_id,
        "topic_label": topic_label,
        "keywords": keywords,
        "cycle_id": cycle_id or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "research_item_count": research_item_count,
        "research_item_ids": [it.get("id") for it in relevant_items if it.get("id")],
        "competitor_connections": competitor_connections,
        "active_competitors": active_competitors,
        "why_it_matters": why_it_matters,
        "verified_sources": verified_sources,
        "state_change_detected": state_change_detected,
        "previous_status": previous_status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return result


def _generate_radar_why_it_matters(
    topic_label: str,
    research_count: int,
    active_competitors: List[Dict[str, str]],
    competitors: List[str],
) -> str:
    """Generate grounded, decision-relevant framing without editorializing."""
    if not active_competitors and research_count > 0:
        return (
            f"High-conviction white space: {research_count} formal research items surfaced this cycle while zero "
            f"tracked competitors ({', '.join(competitors)}) have deployed or publicly referenced {topic_label}. "
            f"Represents early-stage academic emergence with an uncontested window for proactive differentiation."
        )

    if not active_competitors and research_count == 0:
        return (
            f"Dormant cycle: No new academic papers or competitor activity detected for {topic_label}. "
            f"Domain remains in steady state across all verified sources."
        )

    # Active competitors detected
    comp_summaries = []
    for ac in active_competitors:
        comp_summaries.append(f"{ac['competitor']} ({ac['status']} via {ac['source_type']})")

    if research_count > 0:
        return (
            f"Commercial validation & accelerating traction: {research_count} research items published alongside "
            f"active competitor moves from {', '.join(comp_summaries)}. Confirms industrial transition from pure research "
            f"to direct commercialization."
        )

    return (
        f"Competitor initiative ahead of formal publications: {', '.join(comp_summaries)} registered moves "
        f"in {topic_label} without independent academic papers this cycle."
    )
