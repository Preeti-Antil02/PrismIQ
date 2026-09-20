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
    "Anthropic": {
        "is_common_word": False,
        "domains": [
            "anthropic.com",
        ],
        "branded_terms": [
            r"\bclaude\b",
            r"\bamodei\b",
            r"\bdario\s+amodei\b",
            r"\bconstitutional\s+ai\b",
            r"\bprompt\s+caching\b",
            r"\banthropic\s+(?:ai|api|model|claude|research)\b",
        ],
        "business_context": [
            r"\bartificial\s+intelligence\b",
            r"\bai\b",
            r"\bllms?\b",
            r"\bfrontier\s+models?\b",
            r"\blarge\s+language\s+models?\b",
            r"\breasoning\b",
            r"\bsafety\b",
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
    "place", "carousel", "segment",
}

# Dictionary word initialization with WordNet & NLTK Words + Fallback
_WORDNET_AVAILABLE: Optional[bool] = None
_NLTK_WORDS_AVAILABLE: Optional[bool] = None
_WORDNET_CORPUS: Any = None
_NLTK_WORDS_CORPUS: Optional[set] = None


def _init_dictionary_corpora() -> None:
    """Lazily initialize dictionary corpora for robust common-word detection."""
    global _WORDNET_AVAILABLE, _NLTK_WORDS_AVAILABLE, _WORDNET_CORPUS, _NLTK_WORDS_CORPUS
    if _WORDNET_AVAILABLE is not None:
        return
    try:
        from nltk.corpus import wordnet
        _ = wordnet.synsets("test")
        _WORDNET_CORPUS = wordnet
        _WORDNET_AVAILABLE = True
    except Exception:
        try:
            import nltk
            nltk.download("wordnet", quiet=True)
            from nltk.corpus import wordnet
            _ = wordnet.synsets("test")
            _WORDNET_CORPUS = wordnet
            _WORDNET_AVAILABLE = True
        except Exception:
            _WORDNET_AVAILABLE = False

    try:
        from nltk.corpus import words
        _NLTK_WORDS_CORPUS = set(w.lower() for w in words.words())
        _NLTK_WORDS_AVAILABLE = True
    except Exception:
        try:
            import nltk
            nltk.download("words", quiet=True)
            from nltk.corpus import words
            _NLTK_WORDS_CORPUS = set(w.lower() for w in words.words())
            _NLTK_WORDS_AVAILABLE = True
        except Exception:
            _NLTK_WORDS_AVAILABLE = False


def is_dictionary_word(name: str) -> bool:
    """
    Check if a company name is a single standard English dictionary word.
    Uses WordNet synset inspection and NLTK words corpus with offline fallback.
    """
    if not name:
        return False
    clean = name.strip()
    # If entity has spaces, hyphens, or qualifiers, it's not a bare single dictionary word
    if len(clean.split()) > 1 or "(" in clean or ")" in clean or "-" in clean or "/" in clean:
        return False

    clean_lower = clean.lower()
    _init_dictionary_corpora()

    if _WORDNET_AVAILABLE and _WORDNET_CORPUS:
        try:
            syns = _WORDNET_CORPUS.synsets(clean_lower)
            if syns:
                return True
        except Exception:
            pass

    if _NLTK_WORDS_AVAILABLE and _NLTK_WORDS_CORPUS:
        if clean_lower in _NLTK_WORDS_CORPUS:
            return True

    return clean_lower in COMMON_ENGLISH_NOUNS


# Regional / domain expansions for parenthetical qualifiers
# Allows regional qualifiers (e.g. "India") to match canonical demonyms ("Indian"),
# major technology hubs ("Bengaluru", "Hyderabad"), and domestic financial markers ("₹", "crore").
QUALIFIER_EXPANSIONS: Dict[str, List[str]] = {
    "india": [
        r"\bindia\b", r"\bindian\b",
        r"\bbengaluru\b", r"\bbangalore\b", r"\bhyderabad\b",
        r"\bmumbai\b", r"\bdelhi\b", r"\bgurugram\b", r"\bgurgaon\b",
        r"\bnoida\b", r"\bpune\b", r"\bchennai\b",
        r"₹", r"\bcrores?\b", r"\blakhs?\b",
    ]
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
        source_url = signal_or_text.get("source_url", "")
        source_name = signal_or_text.get("source_name", "")
        primary_domain = signal_or_text.get("primary_domain") or signal_or_text.get("domain") or ""
    else:
        comp = company or ""
        t = title or str(signal_or_text)
        e = excerpt
        u = url
        source_url = ""
        source_name = ""
        primary_domain = ""

    comp_clean = comp.strip()

    # Look up primary_domain from storage if not already attached to signal
    if not primary_domain and comp_clean:
        try:
            from . import storage
            anchor = storage.get_entity_anchor(comp_clean)
            if anchor and anchor.get("primary_domain"):
                primary_domain = anchor["primary_domain"]
        except Exception:
            pass

    full_text = f"{t} {e} {u} {source_url} {source_name}".lower()

    # Parse parenthetical qualifier if present (e.g. "Amazon (India)" -> base="Amazon", qualifier="India")
    m_paren = re.match(r"^([^(]+)\s*\(([^)]+)\)$", comp_clean)
    if m_paren:
        base_name = m_paren.group(1).strip()
        qualifier = m_paren.group(2).strip()
    else:
        base_name = comp_clean
        qualifier = None

    # Look up company profile in registry (exact name, or base name if qualified)
    profile = COMPANY_REGISTRY.get(comp_clean) or (COMPANY_REGISTRY.get(base_name) if qualifier else None)

    # 1. Direct domain match (High confidence verification)
    if profile:
        for dom in profile.get("domains", []):
            if dom in full_text:
                return True, f"Verified: Direct domain match '{dom}'"

    if primary_domain:
        dom_clean = primary_domain.lower().strip()
        if dom_clean in full_text:
            return True, f"Verified: Direct primary domain match '{primary_domain}'"

        # Check domain stem if domain is a coined brand name (e.g. "carousell" from "carousell.com")
        dom_stem = dom_clean.split(".")[0]
        if len(dom_stem) >= 4 and not is_dictionary_word(dom_stem):
            if re.search(r"\b" + re.escape(dom_stem) + r"\b", full_text, re.IGNORECASE):
                return True, f"Verified: Primary domain brand anchor match '{dom_stem}' from '{primary_domain}'"

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
        is_common = is_dictionary_word(base_name)

    # 4. Common-Word Company Disambiguation & Stopgap Protection
    if is_common and not qualifier:
        # PART 1 STOPGAP: If a single dictionary word lacks an explicit registry profile
        # or domain anchor, immediately suppress news signals at the noise-suppression layer.
        # Do NOT let coined proper noun matching apply to plain English words.
        if not profile and not primary_domain:
            return False, f"Suppressed: Common-noun dictionary word '{comp_clean}' without registry profile or domain anchor (Stopgap protection)"

        # If anchored by a primary domain but not in COMPANY_REGISTRY,
        # an article MUST have matched the domain or unique brand stem in Step 1.
        # Generic dictionary word collisions (e.g. baggage carousel theft, TV show plans in place) are rejected.
        if primary_domain and not profile:
            return False, f"Suppressed: Common-noun dictionary word '{comp_clean}' lacking domain anchor match for '{primary_domain}'"

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

    # 5. Qualified Entities (e.g. "Amazon (India)")
    # When a regional/domain qualifier is specified, require bounded co-occurrence
    if qualifier and base_name:
        base_lower = base_name.lower()
        qual_lower = qualifier.lower()
        base_pat = r"\b" + re.escape(base_lower) + r"\b"

        # Check if base company name is present in article text
        if not re.search(base_pat, full_text):
            return False, f"Suppressed: Base company name '{base_name}' not found in article text"

        # NOTE ON HOMONYM GUARDS:
        # The geographical/environmental guard below is a narrow, hand-built heuristic specifically
        # implemented to prevent South American geographical homonym collisions for the company name "Amazon"
        # during climate/monsoon articles (e.g. El Niño). It is NOT a general semantic disambiguation principle.
        # Other tracked or future companies with common-noun, geographical, or acronym names
        # (e.g. Place, Carousel, EAB, Patagonia) carry distinct homonym risks that this list does not address
        # and require either explicit registry profiles or upstream NER entity linking.
        if base_lower == "amazon":
            geo_negative_patterns = [
                r"\brainforest\b", r"\bdeforestation\b", r"\bamazon\s+basin\b",
                r"\bamazon\s+river\b", r"\bel\s+niño\b", r"\bwildfires?\b",
            ]
            biz_patterns = [
                r"\be-?commerce\b", r"\bretail\b", r"\bprime\b", r"\balexa\b",
                r"\bcloud\b", r"\baws\b", r"\bmarketplace\b", r"\bnow\b",
                r"\bquick\s+commerce\b", r"\bdeliver(?:y|ies)\b", r"\bsales\b",
            ]
            has_geo_neg = any(re.search(pat, full_text) for pat in geo_negative_patterns)
            has_biz = any(re.search(pat, full_text) for pat in biz_patterns)
            if has_geo_neg and not has_biz:
                return False, "Suppressed: Amazon geographical/environmental context (rainforest/river/weather) without commercial operations"

        # Retrieve qualifier pattern list (supporting regional expansions like hubs & demonyms)
        qual_patterns = QUALIFIER_EXPANSIONS.get(qual_lower, [r"\b" + re.escape(qual_lower) + r"\b"])

        # Bounded association check:
        # A qualifier like (India) requires direct or bounded association with the base company
        for q_pat in qual_patterns:
            # Condition A: Direct compound phrase (e.g. "Amazon India", "Amazon's Bengaluru", "Amazon in India")
            compound_pat = r"\b" + re.escape(base_lower) + r"(?:['’]s)?\s+(?:in\s+|to\s+|,\s+)?" + q_pat
            if re.search(compound_pat, full_text):
                return True, f"Verified: Direct qualified entity compound '{base_name}' with '{qualifier}' ({q_pat})"

            # Condition B: Both base and qualifier present in headline (title)
            if re.search(base_pat, t.lower()) and re.search(q_pat, t.lower()):
                return True, f"Verified: Qualified entity pairing in title '{base_name}' and '{qualifier}' ({q_pat})"

            # Condition C: Bounded sentence-level co-occurrence (within same sentence, max 120 characters)
            bounded_1 = re.search(r"\b" + re.escape(base_lower) + r"\b[^.?!;\n]{0,120}" + q_pat, full_text)
            bounded_2 = re.search(q_pat + r"[^.?!;\n]{0,120}\b" + re.escape(base_lower) + r"\b", full_text)
            if bounded_1 or bounded_2:
                return True, f"Verified: Bounded sentence co-occurrence of '{base_name}' and '{qualifier}' ({q_pat})"

        # Condition D: If qualifier is in URL domain or path (e.g. amazon.in or /india/)
        if f"{base_lower}.in" in u or f"/{qual_lower}/" in u:
            return True, f"Verified: Regional URL attribution for '{base_name}' ({qualifier})"

        return False, f"Suppressed: Base company '{base_name}' present but lacks bounded association with qualifier '{qualifier}'"

    # 6. Non-Common Coined Company Names (e.g. Vercel, Netlify)
    # Distinctive proper nouns with no dictionary meaning have negligible chance of generic collision.
    comp_pattern = r"\b" + re.escape(comp_clean.lower()) + r"\b"
    if re.search(comp_pattern, full_text):
        return True, f"Verified: Distinctive coined company name '{comp_clean}' match"

    # Default fallback: If company name appears at all, preserve conservatively
    if comp_clean.lower() in full_text:
        return True, "Preserved: Company name present (conservative bias)"

    return False, f"Suppressed: Company name '{comp_clean}' not found in article text"
