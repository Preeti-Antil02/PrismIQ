"""
General Relevance Verification and Entity Disambiguation for PrismIQ.

Solves the entity-disambiguation bug where bare company names that are common English
words (e.g. "Stripe", "Gobble", "Square", "Box") trigger false-positive news ingestion
when queried via news APIs (e.g. Currents API) without business context verification.

Design Principles:
1. General and extensible: Registry-based architecture rather than hardcoded company-specific patches.
2. Direct domain / branded product grounding: Matches to official domains (e.g. stripe.com)
   or explicit sub-products (e.g. Stripe Connect, Stripe Atlas, Stripe Terminal) automatically verify.
3. Common-word disambiguation: Common-word company names require co-occurring business context
   (e.g. payments, fintech, billing, checkout, API) and reject known negative idioms
   (e.g. "Cat in the Hat", "Stars and Stripes", "zebra stripes") unless accompanied by business context.
4. Non-common coined names: Distinctive coined proper nouns (e.g. Vercel, Netlify) are preserved
   with high confidence.
5. Conservative auditability: Returns structured (is_relevant, explanation) tuple for logging
   and persistence into `noise_suppression_decisions`.
"""

import re
from typing import Any, Dict, List, Optional, Tuple, Union


# Canonical Company Profiles Registry
COMPANY_REGISTRY: Dict[str, Dict[str, Any]] = {
    "Stripe": {
        "is_common_word": True,
        "domains": [
            "stripe.com",
            "stripe.dev",
        ],
        "branded_terms": [
            r"\bstripe\s+(?:connect|billing|terminal|payments?|atlas|radar|treasury|capital|issuing|climate|tax|sigma|identity|financial\s+connections)\b",
            r"\bcollison\b",
            r"\bstripe(?:\s+inc\.?|\s+api|\s+checkout|\s+sdk|\s+dashboard|\s+elements)\b",
            r"\bpay\s+with\s+stripe\b",
            r"\bpowered\s+by\s+stripe\b",
        ],
        "business_context": [
            r"\bpayments?\b",
            r"\bfintech\b",
            r"\bcheckout\b",
            r"\bbilling\b",
            r"\bmerchants?\b",
            r"\bcredit\s+cards?\b",
            r"\bbanking\b",
            r"\bfinancial\s+(?:infrastructure|services|technology)\b",
            r"\btransactions?\b",
            r"\bpayment\s+gateway\b",
            r"\be-?commerce\b",
            r"\bstartup\s+valuation\b",
            r"\bacquirer\b",
            r"\binterchange\b",
            r"\bdeveloper\s+platform\b",
            r"\bapi\b",
            r"\bsdk\b",
        ],
        "negative_indicators": [
            r"\bstars\s+and\s+stripes\b",
            r"\bcat\s+in\s+the\s+hat\b",
            r"\bcolourful\s+stripes?\b",
            r"\bcolorful\s+stripes?\b",
            r"\btiger\s+stripes?\b",
            r"\bzebra\s+stripes?\b",
            r"\bstripers?\b",
            r"\bpinstripes?\b",
            r"\bcomic\s+strip\b",
            r"\bdress\b",
            r"\bwardrobe\b",
            r"\bfashion\b",
            r"\bvacation\b",
            r"\bfishing\b",
            r"\brcmp\b",
            r"\bair\s+force\s+stripes\b",
            r"\brank\s+stripes\b",
        ],
    },
    "Gobble": {
        "is_common_word": True,
        "domains": [
            "gobble.com",
        ],
        "branded_terms": [
            r"\bgobble\s+(?:meal|kit|delivery|dinner|inc\.?)\b",
        ],
        "business_context": [
            r"\bmeal\s+kits?\b",
            r"\bfood\s+delivery\b",
            r"\bdinner\b",
            r"\brecipe\b",
            r"\bculinary\b",
            r"\bcooking\b",
            r"\bsubscription\s+box\b",
        ],
        "negative_indicators": [
            r"\bgobble\s+up\b",
            r"\bturkey\b",
            r"\bthanksgiving\b",
            r"\bgobbling\b",
        ],
    },
    "Square": {
        "is_common_word": True,
        "domains": [
            "squareup.com",
            "block.xyz",
        ],
        "branded_terms": [
            r"\bsquare\s+(?:pos|point\s+of\s+sale|reader|register|terminal|card)\b",
            r"\bblock(?:\s+inc\.?)\b",
            r"\bjack\s+dorsey\b",
        ],
        "business_context": [
            r"\bpayments?\b",
            r"\bpos\b",
            r"\bfintech\b",
            r"\bmerchant\b",
            r"\bsmall\s+business\b",
        ],
        "negative_indicators": [
            r"\btimes\s+square\b",
            r"\bsquare\s+feet\b",
            r"\bsquare\s+meter\b",
            r"\bsquare\s+root\b",
            r"\btown\s+square\b",
        ],
    },
    "Box": {
        "is_common_word": True,
        "domains": [
            "box.com",
        ],
        "branded_terms": [
            r"\bbox\s+(?:inc\.?|sign|ai|platform)\b",
            r"\baaron\s+levie\b",
        ],
        "business_context": [
            r"\bcloud\s+content\b",
            r"\benterprise\s+storage\b",
            r"\bfile\s+sharing\b",
            r"\bdocument\s+management\b",
        ],
        "negative_indicators": [
            r"\bbox\s+office\b",
            r"\bcardboard\s+box\b",
            r"\bboxing\b",
            r"\bblack\s+box\b",
        ],
    },
    "Target": {
        "is_common_word": True,
        "domains": [
            "target.com",
        ],
        "branded_terms": [
            r"\btarget\s+corp(?:oration)?\b",
            r"\bbrian\s+cornell\b",
            r"\btarget\s+circle\b",
        ],
        "business_context": [
            r"\bretail\b",
            r"\bearnings\b",
            r"\be-?commerce\b",
            r"\bstore\b",
            r"\bsuperstore\b",
            r"\bmerchandise\b",
            r"\bsame-day\s+delivery\b",
        ],
        "negative_indicators": [
            r"\btarget\s+audience\b",
            r"\btarget\s+market\b",
            r"\beasy\s+target\b",
            r"\bmoving\s+target\b",
            r"\bon\s+target\b",
            r"\btarget\s+practice\b",
            r"\bhit\s+the\s+target\b",
        ],
    },
    "Apple": {
        "is_common_word": True,
        "domains": [
            "apple.com",
        ],
        "branded_terms": [
            r"\btim\s+cook\b",
            r"\biphone\b",
            r"\bipad\b",
            r"\bmacbook\b",
            r"\bapple\s+watch\b",
            r"\bios\b",
            r"\bmacos\b",
            r"\bvision\s+pro\b",
        ],
        "business_context": [
            r"\btech(?:nology)?\b",
            r"\bhardware\b",
            r"\bsoftware\b",
            r"\bsilicon\b",
            r"\bchip\b",
            r"\bsmartphone\b",
            r"\bapp\s+store\b",
        ],
        "negative_indicators": [
            r"\bapple\s+pie\b",
            r"\bapple\s+cider\b",
            r"\bapple\s+tree\b",
            r"\bapples\s+and\s+oranges\b",
            r"\bbig\s+apple\b",
        ],
    },
    "Scale": {
        "is_common_word": True,
        "domains": [
            "scale.com",
        ],
        "branded_terms": [
            r"\bscale\s+ai\b",
            r"\balexandr\s+wang\b",
        ],
        "business_context": [
            r"\bdata\s+labeling\b",
            r"\bfrontier\s+models?\b",
            r"\bllms?\b",
            r"\btraining\s+data\b",
            r"\bartificial\s+intelligence\b",
            r"\bvaluation\b",
            r"\bfunding\b",
        ],
        "negative_indicators": [
            r"\bon\s+a\s+large\s+scale\b",
            r"\beconomies\s+of\s+scale\b",
            r"\bscale\s+up\b",
            r"\btip\s+the\s+scale\b",
            r"\bweighing\s+scale\b",
            r"\bfish\s+scales?\b",
        ],
    },
    "Ramp": {
        "is_common_word": True,
        "domains": [
            "ramp.com",
        ],
        "branded_terms": [
            r"\beric\s+glyman\b",
            r"\bramp\s+card\b",
            r"\bramp\s+finance\b",
        ],
        "business_context": [
            r"\bcorporate\s+cards?\b",
            r"\bspend\s+management\b",
            r"\bexpense\b",
            r"\bfintech\b",
            r"\baccounts\s+payable\b",
            r"\bprocurement\b",
        ],
        "negative_indicators": [
            r"\bon-?ramp\b",
            r"\boff-?ramp\b",
            r"\bramp\s+up\b",
            r"\bboat\s+ramp\b",
            r"\bhighway\s+ramp\b",
            r"\bwheelchair\s+ramp\b",
        ],
    },
    "Blend": {
        "is_common_word": True,
        "domains": [
            "blend.com",
        ],
        "branded_terms": [
            r"\bnima\s+ghamsari\b",
            r"\bblend\s+labs\b",
        ],
        "business_context": [
            r"\bmortgage\b",
            r"\bdigital\s+lending\b",
            r"\bconsumer\s+banking\b",
            r"\bloan\s+origination\b",
            r"\bfintech\b",
            r"\bcredit\s+unions?\b",
        ],
        "negative_indicators": [
            r"\bcoffee\s+blend\b",
            r"\bblend\s+in\b",
            r"\bblend\s+together\b",
            r"\bspice\s+blend\b",
            r"\bfabric\s+blend\b",
        ],
    },
    "Anchor": {
        "is_common_word": True,
        "domains": [
            "anchor.fm",
        ],
        "branded_terms": [
            r"\banchor\s+by\s+spotify\b",
            r"\bspotify\s+for\s+podcasters\b",
        ],
        "business_context": [
            r"\bpodcasts?\b",
            r"\baudio\s+hosting\b",
            r"\bpodcaster\b",
            r"\bmonetization\b",
            r"\brss\s+feed\b",
            r"\bstreaming\b",
        ],
        "negative_indicators": [
            r"\bnews\s+anchor\b",
            r"\bdrop\s+anchor\b",
            r"\banchor\s+tenant\b",
            r"\bboat\s+anchor\b",
            r"\banchor\s+leg\b",
        ],
    },
    "Vercel": {
        "is_common_word": False,
        "domains": [
            "vercel.com",
            "vercel.app",
        ],
        "branded_terms": [
            r"\bnext\.?js\b",
            r"\bturbo(?:pack|repo)\b",
            r"\bv0(?:\.dev)?\b",
            r"\bguillermo\s+rauch\b",
            r"\bai\s+sdk\b",
        ],
        "business_context": [
            r"\bfrontend\b",
            r"\bdeploy(?:ment)?\b",
            r"\bserverless\b",
            r"\bhosting\b",
            r"\bedge\s+network\b",
            r"\bweb\s+framework\b",
        ],
        "negative_indicators": [],
    },
    "Netlify": {
        "is_common_word": False,
        "domains": [
            "netlify.com",
            "netlify.app",
        ],
        "branded_terms": [
            r"\bjamstack\b",
            r"\bmathias\s+biilmann\b",
            r"\bnetlify\s+connect\b",
            r"\bnetlify\s+create\b",
        ],
        "business_context": [
            r"\bfrontend\b",
            r"\bdeploy(?:ment)?\b",
            r"\bserverless\b",
            r"\bhosting\b",
            r"\bedge\s+functions?\b",
            r"\bcomposable\s+web\b",
        ],
        "negative_indicators": [],
    },
    "Cloudflare Pages/Workers": {
        "is_common_word": False,
        "domains": [
            "cloudflare.com",
            "workers.dev",
            "pages.dev",
        ],
        "branded_terms": [
            r"\bworkers?\b",
            r"\bpages\b",
            r"\bworkerd\b",
            r"\br2\b",
            r"\bd1\b",
            r"\bkv\b",
            r"\bhyperdrive\b",
            r"\bvectorize\b",
            r"\bdurable\s+objects?\b",
        ],
        "business_context": [
            r"\bedge\b",
            r"\bcdn\b",
            r"\bserverless\b",
            r"\bdns\b",
            r"\bddos\b",
            r"\bcloud\s+network\b",
        ],
        "negative_indicators": [],
    },
    "PostHog": {
        "is_common_word": False,
        "domains": [
            "posthog.com",
        ],
        "branded_terms": [
            r"\bproduct\s+analytics\b",
            r"\bsession\s+replay\b",
            r"\bfeature\s+flags?\b",
            r"\bhogql\b",
        ],
        "business_context": [
            r"\banalytics\b",
            r"\bopen\s+source\b",
            r"\btelemetry\b",
            r"\bdeveloper\s+tools\b",
        ],
        "negative_indicators": [],
    },
}

# Aliases for Cloudflare variants
COMPANY_REGISTRY["Cloudflare"] = COMPANY_REGISTRY["Cloudflare Pages/Workers"]
COMPANY_REGISTRY["Cloudflare Pages"] = COMPANY_REGISTRY["Cloudflare Pages/Workers"]
COMPANY_REGISTRY["Cloudflare Workers"] = COMPANY_REGISTRY["Cloudflare Pages/Workers"]

# General English common nouns that require tech/business context if an untracked company is queried
COMMON_ENGLISH_NOUNS = {
    "stripe", "gobble", "square", "box", "apple", "target", "block",
    "nest", "ring", "clover", "scale", "ramp", "branch", "blend",
    "anchor", "bolt", "glide", "drift", "ember", "beacon", "roast",
}


def verify_news_relevance(
    signal_or_text: Union[Dict[str, Any], str],
    company: Optional[str] = None,
    title: str = "",
    excerpt: str = "",
    url: str = "",
) -> Tuple[bool, str]:
    """
    Verify whether a news article or signal is genuinely relevant to the specified company.
    
    Args:
        signal_or_text: Either a raw_signal dictionary or article text.
        company: Company name to verify against.
        title: Article title (if signal_or_text is string).
        excerpt: Article excerpt/description (if signal_or_text is string).
        url: Article URL.
        
    Returns:
        (is_relevant, explanation)
    """
    if isinstance(signal_or_text, dict):
        comp = signal_or_text.get("company") or signal_or_text.get("company_name") or (company or "")
        t = signal_or_text.get("title", "")
        e = signal_or_text.get("raw_excerpt", "")
        u = signal_or_text.get("url", "")
    else:
        comp = company or ""
        t = title or str(signal_or_text)
        e = excerpt
        u = url

    comp_clean = comp.strip()
    full_text = f"{t} {e} {u}".lower()

    # Look up company profile in registry
    profile = COMPANY_REGISTRY.get(comp_clean)

    # 1. Direct domain match (High confidence verification)
    if profile:
        for dom in profile.get("domains", []):
            if dom in full_text:
                return True, f"Verified: Direct domain match '{dom}'"

    # 2. Specific branded terms and executive names (High confidence verification)
    if profile:
        for brand_pat in profile.get("branded_terms", []):
            if re.search(brand_pat, full_text, re.IGNORECASE):
                return True, f"Verified: Product/brand pattern match '{brand_pat}'"

    # 3. Determine if the company is a common English word
    is_common = False
    if profile:
        is_common = profile.get("is_common_word", False)
    else:
        # Fallback check against known common-noun words
        first_word = comp_clean.lower().split()[0] if comp_clean else ""
        is_common = first_word in COMMON_ENGLISH_NOUNS

    # 4. Common-Word Company Disambiguation
    if is_common:
        # Step 4a: Check negative indicators (known idioms, fashion, clothing, animal stripes, etc.)
        neg_indicators = profile.get("negative_indicators", []) if profile else []
        matched_neg = None
        for neg in neg_indicators:
            if re.search(neg, full_text, re.IGNORECASE):
                matched_neg = neg
                break

        # Step 4b: Check business context
        biz_context_patterns = profile.get("business_context", []) if profile else [
            r"\btechnology\b", r"\bsoftware\b", r"\bplatform\b", r"\bapi\b", r"\bcloud\b", r"\bbusiness\b"
        ]
        matched_biz = []
        for biz_pat in biz_context_patterns:
            if re.search(biz_pat, full_text, re.IGNORECASE):
                matched_biz.append(biz_pat)

        # If a negative idiom matched and NO business context is present -> reject
        if matched_neg and not matched_biz:
            return False, f"Suppressed: Negative idiom '{matched_neg}' without business context"

        # If it is a common word, require at least ONE co-occurring business context keyword
        if not matched_biz:
            return False, f"Suppressed: Common-noun company name '{comp_clean}' without industry/business context"

        # If negative idiom was present but accompanied by business context, verify cautiously
        if matched_neg and matched_biz:
            # E.g. "Stripe payments integration on fashion site" -> Keep, note both
            return True, f"Verified: Contextual match with business terms {matched_biz[:2]} despite idiom '{matched_neg}'"

        return True, f"Verified: Contextual match with business terms {matched_biz[:2]}"

    # 5. Non-Common Coined Company Names (e.g. Vercel, Netlify)
    # Distinctive proper nouns with no dictionary meaning have negligible chance of generic collision.
    comp_pattern = r"\b" + re.escape(comp_clean.lower()) + r"\b"
    if re.search(comp_pattern, full_text):
        return True, f"Verified: Distinctive coined company name '{comp_clean}' match"

    # Default fallback: If company name appears at all, preserve conservatively
    if comp_clean.lower() in full_text:
        return True, "Preserved: Company name present (conservative bias)"

    return False, f"Suppressed: Company name '{comp_clean}' not found in article text"
