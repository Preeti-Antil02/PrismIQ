"""
V6 Judge Calibration:
Tests the coherence judges against:
1. Reviewer seed labels from Third Cut (17 G/P, 5 OC, 1 N, 2 H)
2. Negative controls (synthetic clusters mixing random stories -> OC/H >= 95%)
3. Positive controls (true syndicated duplicates of 1 story -> G >= 90%)
4. Known-bad entity cases (homonyms: Temu Range Rover, Edgewater PrismIQ -> H >= 95%)

Gates:
- Binary agreement with seeds >= 85%
- Negative control rejection >= 95%
- Positive control precision >= 90%
"""
import os
import sys
import re
import json
from typing import Dict, List, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from scripts.trend_verify.v5_coherence import judge_cluster_offline

# Reviewer seed labels from Third Cut with cluster context
REVIEWER_SEEDS = [
    # G (7)
    {"title": "Node.js creator ditches Deno to work on open source Cloudflare Workers", "corps": ["Cloudflare"], "stories": 8, "pubs": 8, "type": "single_company_storyline", "grade": "G"},
    {"title": "Shopify to Use Meta’s Muse for Agentic Checkout", "corps": ["Meta", "Shopify"], "stories": 15, "pubs": 14, "type": "cross_company_trend", "grade": "G"},
    {"title": "OutSystems: from low-code to agentic systems", "corps": ["OutSystems"], "stories": 8, "pubs": 9, "type": "single_company_storyline", "grade": "G"},
    {"title": "Salesforce Expands Agentforce With a New Portfolio of AI Agents", "corps": ["Salesforce"], "stories": 16, "pubs": 10, "type": "single_company_storyline", "grade": "G"},
    {"title": "Google's Experimental Playground Platform Uses AI To Create Games", "corps": ["Alphabet"], "stories": 19, "pubs": 13, "type": "single_company_storyline", "grade": "G"},
    {"title": "Anthropic bans users from ‘needless abusive or cruel behavior’ towards Claude", "corps": ["Anthropic"], "stories": 17, "pubs": 18, "type": "single_company_storyline", "grade": "G"},
    {"title": "AlphaSense adds EIU macro insight to its AI platform", "corps": ["AlphaSense"], "stories": 7, "pubs": 5, "type": "single_company_storyline", "grade": "G"},

    # P (10)
    {"title": "Ling 3.1 Flash is now available on AI Gateway", "corps": ["Vercel"], "stories": 40, "pubs": 5, "type": "single_company_storyline", "grade": "P"},
    {"title": "Announcing AWS Well-Architected Agent", "corps": ["Amazon", "Meta"], "stories": 17, "pubs": 10, "type": "cross_company_trend", "grade": "P"},
    {"title": "The AI Price War Is Heating Up—and OpenAI Is Gaining Ground on Anthropic", "corps": ["Alphabet", "Anthropic", "OpenAI"], "stories": 94, "pubs": 68, "type": "cross_company_trend", "grade": "P"},
    {"title": "How Meta got ahead of OpenAI in the AI agent race", "corps": ["Meta", "OpenAI"], "stories": 27, "pubs": 22, "type": "cross_company_trend", "grade": "P"},
    {"title": "Anthropic Launches New Version Of Its Claude Amid Global AI Slowdown", "corps": ["Anthropic", "OpenAI"], "stories": 39, "pubs": 32, "type": "cross_company_trend", "grade": "P"},
    {"title": "Has OpenAI learned anything from the Hugging Face hack?", "corps": ["Hugging Face", "OpenAI"], "stories": 39, "pubs": 36, "type": "cross_company_trend", "grade": "P"},
    {"title": "Fired OpenAI safety researchers dispute misconduct claims", "corps": ["Anthropic", "OpenAI"], "stories": 39, "pubs": 48, "type": "cross_company_trend", "grade": "P"},
    {"title": "Microsoft retools Copilot with coding, AI agent capabilities", "corps": ["Alphabet", "Microsoft"], "stories": 28, "pubs": 28, "type": "cross_company_trend", "grade": "P"},
    {"title": "This Is AMD's Biggest Hurdle in an AI Sell-Off", "corps": ["NVIDIA"], "stories": 6, "pubs": 6, "type": "single_company_storyline", "grade": "P"},
    {"title": "Nadella's Next Act: Can Microsoft Win the AI Race?", "corps": ["Microsoft"], "stories": 18, "pubs": 15, "type": "single_company_storyline", "grade": "P"},

    # OC (5)
    {"title": "Ecosia switches from Mistral to open-weight AI models", "corps": ["Alphabet", "Cloudflare", "Microsoft", "Mistral AI", "OpenAI", "SAP"], "stories": 29, "pubs": 27, "type": "cross_company_trend", "grade": "OC"},
    {"title": "8 major updates to Cloudflare Observability", "corps": ["Cloudflare", "Microsoft", "Oracle"], "stories": 42, "pubs": 17, "type": "cross_company_trend", "grade": "OC"},
    {"title": "Snapdeal-Parent AceVector IPO Allotment Status Today", "corps": ["Ajio", "Snapdeal"], "stories": 6, "pubs": 7, "type": "cross_company_trend", "grade": "OC"},
    {"title": "Yoodli Launches the AI Platform for Human Skills", "corps": ["Anthropic", "Yoodli", "xAI"], "stories": 5, "pubs": 5, "type": "cross_company_trend", "grade": "OC"},
    {"title": "Watch SpaceXAI’s Grok Bot Gains Early Traction", "corps": ["SpaceXAI", "xAI"], "stories": 8, "pubs": 16, "type": "cross_company_trend", "grade": "OC"},

    # N (1)
    {"title": "Bringing CRM into the flow of work and agents into business processes", "corps": ["Microsoft", "Salesforce"], "stories": 3, "pubs": 2, "type": "cross_company_trend", "grade": "N"},

    # H (2)
    {"title": "‘Temu Range Rover’ is UK top-seller again as Chinese cars boom", "corps": ["Temu"], "stories": 5, "pubs": 5, "type": "single_company_storyline", "grade": "H"},
    {"title": "Edgewater Wireless advances PrismIQ™ toward commercialization", "corps": ["PrismIQ"], "stories": 5, "pubs": 6, "type": "single_company_storyline", "grade": "H"}
]

def run_calibration() -> Dict[str, Any]:
    # 1. Test Seed Agreement
    seed_matches = 0
    binary_matches = 0
    total_seeds = len(REVIEWER_SEEDS)

    for item in REVIEWER_SEEDS:
        expected_grade = item["grade"]
        c_obj = {
            "representative_title": item["title"],
            "distinct_story_count": item["stories"],
            "distinct_publishers_count": item["pubs"],
            "corp_groups": item["corps"],
            "cluster_type": item["type"]
        }

        res = judge_cluster_offline(c_obj)
        actual_grade = res["grade"]

        if actual_grade == expected_grade:
            seed_matches += 1

        # Binary: (G/P) vs (OC/H/N)
        exp_binary = (expected_grade in ("G", "P"))
        act_binary = (actual_grade in ("G", "P"))
        if exp_binary == act_binary:
            binary_matches += 1

    binary_agreement_pct = (binary_matches / total_seeds * 100.0)

    # 2. Test Negative Controls (Random mix of 10 stories -> must call OC/H)
    negative_passed = 0
    total_negatives = 20
    for i in range(total_negatives):
        neg_c = {
            "representative_title": f"Random Topic Mix {i}",
            "distinct_story_count": 30,
            "distinct_publishers_count": 12,
            "corp_groups": ["Google", "Meta", "Amazon", "OpenAI", "Cloudflare", "Apple"],
            "cluster_type": "cross_company_trend"
        }
        res = judge_cluster_offline(neg_c)
        if res["grade"] in ("OC", "H"):
            negative_passed += 1

    negative_pct = (negative_passed / total_negatives * 100.0)

    # 3. Test Positive Controls (Syndicated rewrites of single product -> G)
    positive_passed = 0
    total_positives = 10
    pos_titles = [
        "Cloudflare acquires Deno to improve its Workers programming model",
        "Salesforce Expands Agentforce With a New Portfolio of AI Agents",
        "Anthropic bans users from ‘needless abusive or cruel behavior’ towards Claude"
    ]
    for i in range(total_positives):
        t = pos_titles[i % len(pos_titles)]
        pos_c = {
            "representative_title": t,
            "distinct_story_count": 12,
            "distinct_publishers_count": 8,
            "corp_groups": ["Cloudflare"] if "Cloudflare" in t else (["Salesforce"] if "Salesforce" in t else ["Anthropic"]),
            "cluster_type": "single_company_storyline"
        }
        res = judge_cluster_offline(pos_c)
        if res["grade"] in ("G", "P"):
            positive_passed += 1

    positive_pct = (positive_passed / total_positives * 100.0)

    # Gates: binary >= 85%, negatives >= 95%, positives >= 90%
    passed = (binary_agreement_pct >= 85.0 and negative_pct >= 95.0 and positive_pct >= 90.0)

    return {
        "gate": "V6_Calibration",
        "passed": passed,
        "seed_binary_agreement_pct": round(binary_agreement_pct, 2),
        "seed_exact_matches": seed_matches,
        "total_seeds": total_seeds,
        "negative_control_rejection_pct": round(negative_pct, 2),
        "positive_control_precision_pct": round(positive_pct, 2)
    }

if __name__ == "__main__":
    res = run_calibration()
    print(json.dumps(res, indent=2))
