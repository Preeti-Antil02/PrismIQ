"""
V4 Subject Check Verifier:
Validates that an article is truly about the attributed entity in its title or lead 200 characters.
Uses data-driven entity anchor tables and negative context regex.
Gate: Precision >= 98% across evaluated nodes.
"""
import re
from typing import Dict, List, Any, Tuple

# Data-driven homonym guard table
HOMONYM_DATA_TABLE = {
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

def verify_subject_entity(entity: str, title: str, summary: str, url: str = "") -> bool:
    text = (title + " " + summary[:200]).lower()
    ent_lower = entity.lower().strip()

    if entity in HOMONYM_DATA_TABLE:
        guard = HOMONYM_DATA_TABLE[entity]
        for fpat in guard["forbidden_contexts"]:
            if re.search(fpat, text):
                return False
        for rpat in guard["required_anchors"]:
            if re.search(rpat, text) or (url and re.search(rpat, url.lower())):
                return True
        return False

    # Standard entity check: word boundary match in title or lead 200 chars
    if re.search(rf"\b{re.escape(ent_lower)}\b", text):
        return True

    if url and ent_lower in url.lower():
        return True

    return False

def verify_subject_precision(sample_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(sample_nodes)
    if total == 0:
        return {"gate": "V4_Subject_Check", "passed": True, "precision_pct": 100.0}

    valid_count = 0
    rejected = []

    for n in sample_nodes:
        entity = n.get("company", "")
        title = n.get("title", "")
        summary = n.get("summary", "")
        url = n.get("url", "")

        is_valid = verify_subject_entity(entity, title, summary, url)
        if is_valid:
            valid_count += 1
        else:
            rejected.append({"entity": entity, "title": title, "url": url})

    precision_pct = (valid_count / total * 100.0)
    passed = (precision_pct >= 98.0)

    return {
        "gate": "V4_Subject_Check",
        "passed": passed,
        "total_evaluated": total,
        "valid_count": valid_count,
        "precision_pct": round(precision_pct, 2),
        "rejected_count": len(rejected),
        "rejected_samples": rejected[:10]
    }
