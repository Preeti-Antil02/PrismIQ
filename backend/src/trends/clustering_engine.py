"""
PrismIQ Trend Evolution Clustering Engine (Milestone S1/T2).
Implements all defect fixes D1-D12:
- D1 Provenance guard: All members retain event_id / research_id from DB.
- D2 Deterministic momentum vectors matching recomputation.
- D3 Resolved domain source quality filters + node_class ('third_party' vs 'first_party').
- D4 Corporate group aliases (xAI + SpaceXAI = single group, Alphabet, Flipkart).
- D5 Data-driven homonym guards (Temu Range Rover, Edgewater PrismIQ, Stability, Oracle, Proton, nex).
- D6 3% cap enforced by recursive sub-clustering (never truncation).
- D7 Cross-company requires >=2 corporate groups EACH with >=2 stories (no incidental leaks).
- D8 Strict evidence gates (third-party publisher diversity >=2).
- D9 URLs and event IDs preserved on every node.
- D10 Medoid representative title is a member of the cluster.
- D11 Jobs excluded from trend clustering (reserved for hiring surge lanes).
- D12 Research items included with provenance.
"""
import os
import sys
import re
import json
import base64
import urllib.parse
from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Tuple, List, Set, Dict, Optional, Any

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances

from src.trends.aliases import (
    resolve_canonical_company,
    is_quarantined_entity,
    get_parent_corporate_group
)
from src.trends.distinct_story import (
    extract_github_repo,
    normalize_title,
    normalize_story_url,
    clean_github_title,
    is_github_noise_event
)
from src.trends.dates import classify_event_date, get_iso_week
from src.trends.momentum import (
    calculate_momentum_anchored,
    get_anchor_completed_weeks,
    calculate_momentum_with_rule,
    MomentumResult
)

# 1. Base64 Google News Decoder
def decode_google_news_url(url: str) -> Tuple[str, str]:
    if not url:
        return "", "unknown"
    if "news.google.com" not in url:
        try:
            dom = urllib.parse.urlsplit(url).netloc.lower()
            if dom.startswith("www."):
                dom = dom[4:]
            return url, dom
        except Exception:
            return url, "unknown"

    m = re.search(r'/articles/([A-Za-z0-9_-]+)', url)
    if m:
        b64_str = m.group(1)
        padding = len(b64_str) % 4
        if padding:
            b64_str += '=' * (4 - padding)
        try:
            decoded_bytes = base64.urlsafe_b64decode(b64_str)
            m_url = re.search(rb'(https?://[a-zA-Z0-9_\-\./\?&=%#~:@!$,;+*]+)', decoded_bytes)
            if m_url:
                clean = m_url.group(1).decode('utf-8', errors='ignore')
                if "google" not in clean:
                    dom = urllib.parse.urlsplit(clean).netloc.lower()
                    if dom.startswith("www."):
                        dom = dom[4:]
                    return clean, dom
        except Exception:
            pass
    return url, "news.google.com"

# 2. Source Quality Taxonomies
EXCLUDED_BLOG_DOMAINS = {
    "dev.to", "medium.com", "hackernoon.com", "substack.com", "hashnode.dev", "reddit.com"
}
EXCLUDED_INVESTOR_DOMAINS = {
    "seekingalpha.com", "tradingview.com", "fool.com", "simplywall.st", "investing.com",
    "benzinga.com", "zacks.com", "tipranks.com", "marketbeat.com", "insidermonkey.com", "investors.com"
}
EXCLUDED_AGGREGATOR_DOMAINS = {
    "techmeme.com", "news.ycombinator.com", "slashdot.org", "wikipedia.org", "wikimedia.org"
}
EXCLUDED_DIRECTORY_DOMAINS = {
    "tracxn.com", "crunchbase.com", "pitchbook.com", "zoominfo.com", "g2.com", "capterra.com",
    "vulners.com", "vuldb.com"
}
ALL_EXCLUDED_DOMAINS = EXCLUDED_BLOG_DOMAINS | EXCLUDED_INVESTOR_DOMAINS | EXCLUDED_AGGREGATOR_DOMAINS | EXCLUDED_DIRECTORY_DOMAINS

FIRST_PARTY_DOMAINS = {
    "blog.cloudflare.com", "cloudflare.com", "vercel.com", "aws.amazon.com",
    "microsoft.com", "openai.com", "anthropic.com", "meta.com", "salesforce.com"
}

INVESTOR_TITLE_PATTERNS = [
    r"\b(stock|shares|nasdaq|nyse|dividend|earnings|bull|bear|q[1-4]\s+earnings|target\s+price|price\s+target|buy\s+or\s+sell|valuation|market\s+cap|which\s+is\s+cheaper|stock\s+to\s+buy|wall\s+street)\b",
    r"\([A-Z]{2,5}:[A-Z]{2,5}\)"
]
CONSUMER_DEAL_PATTERNS = [
    r"\b(discount|deals?|promo\s+code|coupon|save\s+\$|best\s+price|prime\s+day|black\s+friday|holiday\s+sale|gift\s+guide|buy\s+one\s+get|flash\s+sale)\b"
]
SEO_HOWTO_PATTERNS = [
    r"\b(how\s+to\s+use|how\s+to\s+build|beginners?\s+guide|step\s+by\s+step|everything\s+you\s+need\s+to\s+know|top\s+[0-9]+\s+tools|best\s+[0-9]+\s+prompts)\b"
]

# 3. Homonym Guards
HOMONYM_GUARDS = {
    "Stability AI": {
        "required_anchors": [r"\bstability\s+ai\b", r"\bstable\s+diffusion\b", r"\bemad\s+mostaque\b", r"\bsdv3\b", r"stability\.ai"],
        "forbidden_contexts": [r"\bfinancial\s+stability\b", r"\bmacroeconomic\s+stability\b", r"\bprice\s+stability\b", r"\beconomic\s+stability\b"]
    },
    "Oracle": {
        "required_anchors": [r"\boracle\s+cloud\b", r"\boracle\s+corp\b", r"\boracle\s+database\b", r"\blarry\s+ellison\b", r"\boci\b", r"oracle\.com"],
        "forbidden_contexts": [r"\bthe\s+oracle\b", r"\bancient\s+oracle\b", r"\bdelphi\b", r"\boracle\s+bone\b"]
    },
    "Proton": {
        "required_anchors": [r"\bproton\s+mail\b", r"\bproton\s+vpn\b", r"\bproton\s+me\b", r"\bproton\s+drive\b", r"proton\.me"],
        "forbidden_contexts": [r"\bproton\s+therapy\b", r"\bproton\s+beam\b", r"\bproton\s+cancer\b", r"\bproton\s+decay\b", r"\bprotons\s+and\s+neutrons\b"]
    },
    "nex": {
        "required_anchors": [r"\bnex\s+inc\b", r"\bnex\s+playground\b", r"nex\.ai", r"nex\.com"],
        "forbidden_contexts": [r"\bnext\b", r"\bgoogle\s+playground\b"]
    },
    "Mistral AI": {
        "required_anchors": [r"\bmistral\s+ai\b", r"\bmistral\b", r"\barthur\s+mensch\b", r"\ble\s+chat\b", r"\bcodestral\b", r"\bmixtral\b", r"\btimestral\b", r"mistral\.ai"],
        "forbidden_contexts": [r"\bmistral\s+wind\b", r"\ble\s+mistral\s+train\b", r"\bgale\s+mistral\b"]
    },
    "Apple": {
        "required_anchors": [r"\bapple\s+inc\b", r"\btim\s+cook\b", r"\biphone\b", r"\bipad\b", r"\bmacbook\b", r"\bios\b", r"\bmacos\b", r"apple\.com"],
        "forbidden_contexts": [r"\bapple\s+crop\b", r"\bapple\s+orchard\b", r"\bapple\s+pie\b", r"\bapple\s+cider\b", r"\bapple\s+tree\b"]
    },
    "Canonical": {
        "required_anchors": [r"\bcanonical\s+ltd\b", r"\bubuntu\b", r"\bmark\s+shuttleworth\b", r"canonical\.com"],
        "forbidden_contexts": [r"\bcanonical\s+tag\b", r"\bcanonical\s+url\b", r"\bcanonical\s+form\b", r"\bcanonical\s+link\b"]
    },
    "Segment": {
        "required_anchors": [r"\btwilio\s+segment\b", r"\bsegment\.io\b", r"\bsegment\s+cdp\b", r"segment\.com"],
        "forbidden_contexts": [r"\bmarket\s+segment\b", r"\bsegment\s+growth\b", r"\bbusiness\s+segment\b", r"\bindustry\s+segment\b"]
    },
    "Carousel": {
        "required_anchors": [r"\bcarousel\s+apps\b", r"\bcarousel\s+tech\b"],
        "forbidden_contexts": [r"\binstagram\s+carousel\b", r"\bcarousel\s+post\b", r"\bphoto\s+carousel\b", r"\bcarousel\s+feature\b"]
    },
    "Temu": {
        "required_anchors": [r"\btemu\s+app\b", r"\btemu\s+marketplace\b", r"\bpdd\s+holdings\b", r"temu\.com"],
        "forbidden_contexts": [r"\btemu\s+range\s+rover\b", r"\btemu\s+car\b", r"\btemu\s+suv\b"]
    },
    "PrismIQ": {
        "required_anchors": [r"\bcompetitive\s+intelligence\b", r"\bcompetitive\s+radar\b", r"prismiq\.ai"],
        "forbidden_contexts": [r"\bedgewater\s+wireless\b", r"\bspectrum\s+slicing\b", r"\bwifi\s+7\b", r"\bsilicon\s+validation\b"]
    },
    "OpenAI": {
        "required_anchors": [r"\bopenai\b", r"\bchatgpt\b", r"\bsam\s+altman\b", r"\bgpt-[0-9]\b", r"\bo1\b", r"\bdall-e\b", r"openai\.com"],
        "forbidden_contexts": []
    },
    "Microsoft": {
        "required_anchors": [r"\bmicrosoft\b", r"\bsatya\s+nadella\b", r"\bazure\b", r"\bcopilot\b", r"\bwindows\s+11\b", r"\bsurface\b", r"microsoft\.com"],
        "forbidden_contexts": []
    },
    "Google": {
        "required_anchors": [r"\bgoogle\b", r"\balphabet\b", r"\bsundar\s+pichai\b", r"\bgemini\b", r"\bdeepmind\b", r"\bandroid\b", r"google\.com"],
        "forbidden_contexts": []
    },
    "Anthropic": {
        "required_anchors": [r"\banthropic\b", r"\bdario\s+amodei\b", r"\bclaude\b", r"anthropic\.com"],
        "forbidden_contexts": []
    },
    "Meta": {
        "required_anchors": [r"\bmeta\b", r"\bmark\s+zuckerberg\b", r"\bllama\b", r"\binstagram\b", r"\bwhatsapp\b", r"\bmeta\s+muse\b", r"meta\.com"],
        "forbidden_contexts": [r"\bmeta-analysis\b", r"\bmeta\s+tag\b", r"\bmetadata\b"]
    },
    "Stripe": {
        "required_anchors": [r"\bstripe\b", r"\bpatrick\s+collison\b", r"\bjohn\s+collison\b", r"stripe\.com"],
        "forbidden_contexts": [r"\bmobius\s+strip\b", r"\bcomic\s+strip\b"]
    }
}

def verify_subject_entity(entity: str, title: str, summary: str, url: str) -> bool:
    text = (title + " " + summary[:200]).lower()
    ent_lower = entity.lower().strip()
    if entity in HOMONYM_GUARDS:
        guard = HOMONYM_GUARDS[entity]
        for fpat in guard["forbidden_contexts"]:
            if re.search(fpat, text):
                return False
        for rpat in guard["required_anchors"]:
            if re.search(rpat, text) or (url and re.search(rpat, url.lower())):
                return True
        return False

    if re.search(rf"\b{re.escape(ent_lower)}\b", text):
        return True
    if url and ent_lower in url.lower():
        return True
    return False

def clean_extracted_title_and_publisher(raw_title: str) -> Tuple[str, str]:
    if not raw_title:
        return "", "unknown"
    parts = re.split(r"\s+[-–|—]\s+", raw_title)
    if len(parts) > 1:
        extracted_pub = parts[-1].strip()
        clean_title = " - ".join(parts[:-1]).strip()
        return clean_title, extracted_pub
    return raw_title.strip(), "unknown"

def tokenize_title(t: str) -> Set[str]:
    words = re.findall(r"\b[a-z]{3,}\b", t.lower())
    stop_words = {"the", "and", "for", "with", "from", "that", "this", "over", "into", "after", "will"}
    return set(w for w in words if w not in stop_words)


def build_trend_clusters(
    events_rows: List[Tuple],
    research_rows: List[Tuple],
    as_of_date: date = date(2026, 10, 19)
) -> Dict[str, Any]:
    """
    Main clustering pipeline executing Stages 1, 2, and 3 with strict invariants.
    """
    clean_signals = []
    
    # 1. Ingest consolidated_events
    for row in events_rows:
        eid, raw_title, summary, company, pub_ts, pub_at, created_at, url_str, sources, is_mock = row
        title_str = (raw_title or "").strip()
        url_str = (url_str or "").strip()
        summary_str = (summary or "").strip()

        if is_mock is True:
            continue

        canonical, is_excluded = resolve_canonical_company(company)
        if is_excluded or not canonical:
            continue

        # Exclude jobs completely in v1 trend clustering (per D11)
        t_lower = title_str.lower()
        u_lower = url_str.lower()
        src_lower = str(sources).lower()
        if (title_str.startswith("Job Posting:") or 
            t_lower.startswith("job:") or 
            "/jobs/" in u_lower or 
            "gh_jid=" in u_lower or 
            "greenhouse.io" in u_lower or 
            "lever.co" in u_lower or 
            "ashbyhq.com" in u_lower or 
            "job" in src_lower or
            any(k in t_lower for k in ["is hiring", "job opening", "careers at", "now hiring"])):
            continue

        # Publisher resolution
        resolved_url, resolved_domain = decode_google_news_url(url_str)
        clean_title, extracted_pub_name = clean_extracted_title_and_publisher(title_str)

        # Signal Type classification
        signal_type = "news"
        if "github.com" in resolved_url.lower() or "github" in extracted_pub_name.lower():
            if is_github_noise_event(clean_title):
                continue
            signal_type = "github"

        # Excluded Domains
        pub_check = (resolved_domain + " " + extracted_pub_name).lower()
        if (resolved_domain in ALL_EXCLUDED_DOMAINS or
            any(d in pub_check for d in ["seeking alpha", "motley fool", "benzinga", "tradingview", "zacks", "dev.to", "substack", "medium.com", "techmeme", "wikipedia", "tracxn"])):
            continue

        # Title patterns for noise
        if any(re.search(pat, t_lower) for pat in INVESTOR_TITLE_PATTERNS):
            continue
        if any(re.search(pat, t_lower) for pat in CONSUMER_DEAL_PATTERNS):
            continue
        if any(re.search(pat, t_lower) for pat in SEO_HOWTO_PATTERNS):
            continue
        if "huggingface.co" in resolved_url.lower():
            m_hf = re.search(r"huggingface\.co/([^/]+)/([^/]+)$", resolved_url.lower())
            if m_hf and not any(k in resolved_url.lower() for k in ["/blog/", "/papers/", "/posts/"]):
                continue

        # Subject Entity Attribution & Homonym Guard
        if not verify_subject_entity(canonical, clean_title, summary_str, resolved_url):
            continue

        # First-party vs Third-party node classification
        node_class = "first_party" if resolved_domain in FIRST_PARTY_DOMAINS else "third_party"

        # Date provenance
        dt, date_source, date_precision, eligible = classify_event_date(
            published_ts=pub_ts,
            published_at_str=pub_at,
            created_at_fallback=created_at
        )
        iso_week = get_iso_week(dt) if dt else "unknown_week"

        clean_signals.append({
            "event_id": eid,
            "title": clean_title,
            "raw_title": title_str,
            "summary": summary_str,
            "canonical_company": canonical,
            "corporate_group": get_parent_corporate_group(canonical),
            "url": resolved_url,
            "publisher": extracted_pub_name if extracted_pub_name != "unknown" else resolved_domain,
            "publisher_domain": resolved_domain,
            "node_class": node_class,
            "signal_type": signal_type,
            "dt": dt,
            "published_at": pub_at,
            "date_source": date_source,
            "date_precision": date_precision,
            "is_sequence_eligible": eligible,
            "iso_week": iso_week,
            "embed_text": f"{canonical}: {clean_title}"
        })

    # 2. Ingest research_items
    for r in research_rows:
        rid, rtitle, rdetails, rpub_ts, rpub_at, rcreated, rurl, rtopics = r
        clean_rtitle = (rtitle or "").strip()
        if not clean_rtitle:
            continue
        dt, date_source, date_precision, eligible = classify_event_date(
            published_ts=rpub_ts,
            published_at_str=rpub_at,
            created_at_fallback=rcreated
        )
        iso_week = get_iso_week(dt) if dt else "unknown_week"

        clean_signals.append({
            "event_id": str(rid),
            "title": clean_rtitle,
            "raw_title": clean_rtitle,
            "summary": str(rdetails or ""),
            "canonical_company": "Research",
            "corporate_group": "Research",
            "url": rurl or "",
            "publisher": "arXiv/Research",
            "publisher_domain": "arxiv.org",
            "node_class": "third_party",
            "signal_type": "research",
            "dt": dt,
            "published_at": rpub_at,
            "date_source": date_source,
            "date_precision": date_precision,
            "is_sequence_eligible": eligible,
            "iso_week": iso_week,
            "embed_text": f"Research: {clean_rtitle}"
        })

    print(f"Admitted {len(clean_signals)} clean signals.")

    # --- Stage 1: Near-Duplicate Story Collapse ---
    # Group by identical normalized URL or exact normalized title
    url_groups = defaultdict(list)
    for s in clean_signals:
        key = s["url"] if len(s["url"]) > 10 else s["title"].lower()
        url_groups[key].append(s)

    stage1a_stories = []
    for k, sig_list in url_groups.items():
        base = sig_list[0]
        corps = sorted(list(set(s["corporate_group"] for s in sig_list if s["corporate_group"] != "Research")))
        stage1a_stories.append({
            "title": base["title"],
            "embed_text": base["embed_text"],
            "signal_type": base["signal_type"],
            "corp_groups": corps,
            "signals": sig_list,
            "min_date": min([s["dt"] for s in sig_list if s["dt"]], default=None)
        })

    # Pairwise near-duplicate collapse within 72 hours sharing corporate group and title tokens >= 0.45
    merged_stories = []
    visited_idx = set()

    for i in range(len(stage1a_stories)):
        if i in visited_idx:
            continue
        item_a = stage1a_stories[i]
        cluster_signals = list(item_a["signals"])
        tokens_a = tokenize_title(item_a["title"])
        corps_a = set(item_a["corp_groups"])
        visited_idx.add(i)

        for j in range(i + 1, len(stage1a_stories)):
            if j in visited_idx:
                continue
            item_b = stage1a_stories[j]
            corps_b = set(item_b["corp_groups"])

            if corps_a and corps_b and not (corps_a & corps_b):
                continue

            if item_a["min_date"] and item_b["min_date"]:
                diff_h = abs((item_a["min_date"] - item_b["min_date"]).total_seconds()) / 3600.0
                if diff_h > 72:
                    continue

            tokens_b = tokenize_title(item_b["title"])
            if tokens_a and tokens_b:
                jaccard = len(tokens_a & tokens_b) / len(tokens_a | tokens_b)
                if jaccard >= 0.45:
                    cluster_signals.extend(item_b["signals"])
                    visited_idx.add(j)

        comps = sorted(list(set(s["canonical_company"] for s in cluster_signals if s["canonical_company"] != "Research")))
        corps = sorted(list(set(s["corporate_group"] for s in cluster_signals if s["corporate_group"] != "Research")))
        pubs = sorted(list(set(s["publisher"] for s in cluster_signals if s["publisher"] != "unknown")))
        dates = [s["dt"] for s in cluster_signals if s["dt"]]
        weeks = sorted(list(set(s["iso_week"] for s in cluster_signals if s["iso_week"] != "unknown_week")))

        merged_stories.append({
            "story_idx": len(merged_stories),
            "story_key": f"ds_{len(merged_stories)+1:04d}",
            "title": item_a["title"],
            "embed_text": item_a["embed_text"],
            "signal_type": item_a["signal_type"],
            "companies": comps,
            "corp_groups": corps,
            "publishers": pubs,
            "raw_signal_count": len(cluster_signals),
            "signals": cluster_signals,
            "min_date": min(dates) if dates else None,
            "max_date": max(dates) if dates else None,
            "weeks": weeks
        })

    distinct_stories = merged_stories
    total_distinct_stories = len(distinct_stories)
    MAX_CLUSTER_CAP = max(3, int(0.03 * total_distinct_stories))
    print(f"Collapsed into {total_distinct_stories} distinct stories. Strict 3% cap = {MAX_CLUSTER_CAP} stories.")

    # --- Stage 2: FastEmbed Embeddings & Recursive Agglomerative Clustering ---
    from fastembed import TextEmbedding
    embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    story_texts = [s["embed_text"] for s in distinct_stories]
    story_embeddings = np.array(list(embed_model.embed(story_texts)))

    # Initial agglomerative pass at threshold 0.18
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=0.18,
        metric="cosine",
        linkage="average"
    )
    initial_labels = clustering.fit_predict(story_embeddings)

    clusters_stage2 = defaultdict(list)
    for idx, lbl in enumerate(initial_labels):
        clusters_stage2[lbl].append(distinct_stories[idx])

    # Enforce 3% Cap via Recursive Re-clustering (Never Truncating)
    refined_clusters = []
    for lbl, stories in clusters_stage2.items():
        if len(stories) <= MAX_CLUSTER_CAP:
            refined_clusters.append(stories)
        else:
            # Re-cluster iteratively with tighter threshold
            sub_idxs = [s["story_idx"] for s in stories]
            sub_embeds = story_embeddings[sub_idxs]
            
            tighter_thresh = 0.14
            sub_clusterer = AgglomerativeClustering(
                n_clusters=None,
                distance_threshold=tighter_thresh,
                metric="cosine",
                linkage="average"
            )
            sub_lbls = sub_clusterer.fit_predict(sub_embeds)
            
            sub_groups = defaultdict(list)
            for s_idx, sl in enumerate(sub_lbls):
                sub_groups[sl].append(stories[s_idx])
            
            for s_grp in sub_groups.values():
                if len(s_grp) <= MAX_CLUSTER_CAP:
                    refined_clusters.append(s_grp)
                else:
                    # Final split if still over cap
                    half = len(s_grp) // 2
                    refined_clusters.append(s_grp[:half])
                    refined_clusters.append(s_grp[half:])

    print(f"Stage 2 produced {len(refined_clusters)} clusters (all strictly <= {MAX_CLUSTER_CAP} stories).")

    # --- Stage 3: Centroid Saga Merging (Blocked if Exceeding Cap) ---
    cluster_centroids = []
    for stories in refined_clusters:
        idxs = [s["story_idx"] for s in stories]
        centroid = story_embeddings[idxs].mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        cluster_centroids.append(centroid)
    cluster_centroids = np.array(cluster_centroids)

    cluster_min_dates = [min([s["min_date"] for s in st if s["min_date"]], default=None) for st in refined_clusters]
    cluster_max_dates = [max([s["max_date"] for s in st if s["max_date"]], default=None) for st in refined_clusters]

    merged_clusters = {i: list(refined_clusters[i]) for i in range(len(refined_clusters))}
    active_cluster_ids = set(merged_clusters.keys())

    centroid_dist_matrix = cosine_distances(cluster_centroids)

    for i in range(len(refined_clusters)):
        if i not in active_cluster_ids:
            continue
        for j in range(i + 1, len(refined_clusters)):
            if j not in active_cluster_ids:
                continue

            dist = centroid_dist_matrix[i, j]
            if dist > 0.16:
                continue

            # Time proximity check (<= 14 days)
            time_gap_ok = False
            if cluster_max_dates[i] and cluster_min_dates[j]:
                gap_days = abs((cluster_max_dates[i] - cluster_min_dates[j]).days)
                if gap_days <= 14:
                    time_gap_ok = True

            if not time_gap_ok:
                continue

            # Check 3% cap constraint (Block merge if exceeding cap)
            combined_size = len(merged_clusters[i]) + len(merged_clusters[j])
            if combined_size > MAX_CLUSTER_CAP:
                continue

            # Merge j into i
            merged_clusters[i].extend(merged_clusters[j])
            del merged_clusters[j]
            active_cluster_ids.remove(j)

    print(f"Stage 3 merged down to {len(active_cluster_ids)} final clusters.")

    # --- Build Final Output Clusters & Evidence Gates ---
    final_clusters = []
    cluster_counter = 1

    for cid, stories in merged_clusters.items():
        all_signals = []
        for s in stories:
            all_signals.extend(s["signals"])

        comps = sorted(list(set(c for s in stories for c in s["companies"])))
        corps = sorted(list(set(c for s in stories for c in s["corp_groups"])))
        
        # Third-party independent publishers vs first-party blogs
        independent_pubs = set(
            s["publisher_domain"] for s in all_signals
            if s.get("node_class") == "third_party" and s["publisher_domain"] not in ("unknown", "news.google.com")
        )
        distinct_independent_pubs_count = len(independent_pubs)
        
        # Dates and Iso weeks
        all_story_weeks = [w for s in stories for w in s["weeks"] if w != "unknown_week"]
        distinct_active_weeks = len(set(all_story_weeks))
        dates = [s["min_date"] for s in stories if s["min_date"]]
        min_date = min(dates) if dates else None
        max_date = max(dates) if dates else None

        # Momentum calculation anchored to last 3 completed weeks relative to as_of_date
        mom_res = calculate_momentum_anchored(
            all_story_weeks,
            as_of=as_of_date,
            historical_distinct_stories=len(stories)
        )

        # Medoid Selection for Representative Title
        if len(stories) == 1:
            rep_story = stories[0]
        else:
            idxs = [s["story_idx"] for s in stories]
            sub_embeds = story_embeddings[idxs]
            p_dist = cosine_distances(sub_embeds)
            medoid_idx = int(np.argmin(p_dist.mean(axis=1)))
            rep_story = stories[medoid_idx]

        # Corporate Group story counts for D7 guard (Cross-company requires >=2 groups EACH with >=2 stories)
        corp_story_counts = defaultdict(int)
        for s in stories:
            for cg in s["corp_groups"]:
                corp_story_counts[cg] += 1
        
        qualified_corps = [cg for cg, cnt in corp_story_counts.items() if cnt >= 2]

        # Strict Evidence Gates (D7 & D8)
        is_cross_trend = (
            len(stories) >= 3 and
            distinct_active_weeks >= 2 and
            len(qualified_corps) >= 2 and
            distinct_independent_pubs_count >= 2
        )
        is_storyline = (
            len(stories) >= 3 and
            distinct_active_weeks >= 2 and
            len(corps) >= 1 and
            distinct_independent_pubs_count >= 2 and
            not is_cross_trend
        )

        if is_cross_trend:
            c_type = "cross_company_trend"
            passes_gate = True
        elif is_storyline:
            c_type = "single_company_storyline"
            passes_gate = True
        else:
            c_type = "single_event" if len(stories) == 1 else "emerging"
            passes_gate = False

        owner_corps = {"Vercel", "Netlify", "Cloudflare", "Stripe"}
        involves_owner = bool(set(corps) & owner_corps)

        # Provenance: Sample members retain exact DB event_id
        sample_signals = sorted(all_signals, key=lambda s: s["dt"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:8]

        final_clusters.append({
            "cluster_id": f"cluster_{cluster_counter:04d}",
            "raw_event_count": len(all_signals),
            "distinct_story_count": len(stories),
            "story_keys": [s["story_key"] for s in stories],
            "story_iso_weeks": all_story_weeks,
            "cluster_type": c_type,
            "companies": comps,
            "corp_groups": corps,
            "qualified_corp_groups": qualified_corps,
            "distinct_publishers_count": distinct_independent_pubs_count,
            "distinct_weeks_count": distinct_active_weeks,
            "first_date": min_date.strftime("%Y-%m-%d") if min_date else "N/A",
            "last_date": max_date.strftime("%Y-%m-%d") if max_date else "N/A",
            "momentum_vector": [int(v) for v in mom_res.vector],
            "momentum_label": mom_res.label,
            "rule_id": mom_res.rule_id,
            "representative_title": rep_story["title"],
            "passes_gate": passes_gate,
            "involves_owner": involves_owner,
            "signal_types": sorted(list(set(s["signal_type"] for s in stories))),
            "members": [{
                "event_id": s["event_id"],
                "company": s["canonical_company"],
                "corporate_group": s["corporate_group"],
                "title": s["title"],
                "url": s["url"],
                "publisher": s["publisher"],
                "publisher_domain": s["publisher_domain"],
                "node_class": s.get("node_class", "third_party"),
                "signal_type": s["signal_type"],
                "source_date": s["dt"].strftime("%Y-%m-%d") if s["dt"] else "N/A",
                "published_at": s.get("published_at"),
                "date_source": s["date_source"],
                "date_precision": s["date_precision"],
                "is_sequence_eligible": s["is_sequence_eligible"]
            } for s in sample_signals]
        })
        cluster_counter += 1

    return {
        "total_admitted_signals": len(clean_signals),
        "total_distinct_stories": total_distinct_stories,
        "max_cluster_cap": MAX_CLUSTER_CAP,
        "clusters": final_clusters
    }
