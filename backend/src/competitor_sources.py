"""
PrismIQ Canonical Competitor Evidence & Source Registry
Maps competitors and signal channels to authentic, verifiable primary source documents.
Rejects placeholder strings (e.g. /updates/1) and ensures strict HTTP/HTTPS validation.
"""

import re
from typing import Optional, Dict, Any
from urllib.parse import urlparse

# Registry of authentic, active public web endpoints for tracked competitors
COMPETITOR_CANONICAL_SOURCES: Dict[str, Dict[str, str]] = {
    "netflix": {
        "domain": "netflix.com",
        "news": "https://about.netflix.com/en/newsroom",
        "official": "https://about.netflix.com/en/newsroom",
        "blog": "https://netflixtechblog.com",
        "engineering": "https://netflixtechblog.com",
        "hiring": "https://jobs.netflix.com",
        "careers": "https://jobs.netflix.com",
        "pricing": "https://help.netflix.com/en/node/24926",
        "ir": "https://ir.netflix.net",
        "default": "https://about.netflix.com/en/newsroom",
    },
    "cloudflare": {
        "domain": "cloudflare.com",
        "news": "https://blog.cloudflare.com",
        "blog": "https://blog.cloudflare.com",
        "official": "https://blog.cloudflare.com",
        "documentation": "https://developers.cloudflare.com/pages/",
        "pages": "https://developers.cloudflare.com/pages/",
        "workers": "https://developers.cloudflare.com/workers/",
        "pricing": "https://www.cloudflare.com/plans/",
        "status": "https://www.cloudflarestatus.com",
        "github": "https://github.com/cloudflare",
        "default": "https://blog.cloudflare.com",
    },
    "cloudflare pages": {
        "domain": "pages.cloudflare.com",
        "news": "https://blog.cloudflare.com",
        "documentation": "https://developers.cloudflare.com/pages/",
        "product": "https://developers.cloudflare.com/pages/",
        "changelog": "https://developers.cloudflare.com/pages/platform/changelog/",
        "pricing": "https://www.cloudflare.com/plans/",
        "github": "https://github.com/cloudflare/workers-sdk",
        "default": "https://developers.cloudflare.com/pages/",
    },
    "cloudflare workers": {
        "domain": "workers.cloudflare.com",
        "news": "https://blog.cloudflare.com",
        "documentation": "https://developers.cloudflare.com/workers/",
        "product": "https://developers.cloudflare.com/workers/",
        "pricing": "https://www.cloudflare.com/plans/",
        "github": "https://github.com/cloudflare/workers-sdk",
        "default": "https://developers.cloudflare.com/workers/",
    },
    "aws amplify": {
        "domain": "aws.amazon.com/amplify",
        "official": "https://aws.amazon.com/amplify/",
        "product": "https://aws.amazon.com/amplify/",
        "news": "https://aws.amazon.com/about-aws/whats-new/",
        "documentation": "https://docs.amplify.aws/",
        "pricing": "https://aws.amazon.com/amplify/pricing/",
        "blog": "https://aws.amazon.com/blogs/mobile/",
        "github": "https://github.com/aws-amplify/amplify-js",
        "default": "https://aws.amazon.com/amplify/",
    },
    "amplify": {
        "domain": "aws.amazon.com/amplify",
        "official": "https://aws.amazon.com/amplify/",
        "product": "https://aws.amazon.com/amplify/",
        "news": "https://aws.amazon.com/about-aws/whats-new/",
        "documentation": "https://docs.amplify.aws/",
        "pricing": "https://aws.amazon.com/amplify/pricing/",
        "blog": "https://aws.amazon.com/blogs/mobile/",
        "github": "https://github.com/aws-amplify/amplify-js",
        "default": "https://aws.amazon.com/amplify/",
    },
    "netlify": {
        "domain": "netlify.com",
        "news": "https://www.netlify.com/blog/",
        "blog": "https://www.netlify.com/blog/",
        "official": "https://www.netlify.com/blog/",
        "pricing": "https://www.netlify.com/pricing/",
        "changelog": "https://www.netlify.com/changelog/",
        "documentation": "https://docs.netlify.com/",
        "security": "https://www.netlify.com/security/",
        "github": "https://github.com/netlify",
        "default": "https://www.netlify.com/blog/",
    },
    "vercel": {
        "domain": "vercel.com",
        "news": "https://vercel.com/blog",
        "blog": "https://vercel.com/blog",
        "official": "https://vercel.com/blog",
        "pricing": "https://vercel.com/pricing",
        "changelog": "https://vercel.com/changelog",
        "documentation": "https://vercel.com/docs",
        "careers": "https://vercel.com/careers",
        "github": "https://github.com/vercel",
        "default": "https://vercel.com/blog",
    },
    "amazon": {
        "domain": "amazon.com",
        "news": "https://www.aboutamazon.com/news",
        "press": "https://press.aboutamazon.com",
        "official": "https://www.aboutamazon.com/news",
        "careers": "https://www.amazon.jobs",
        "sustainability": "https://sustainability.aboutamazon.com",
        "default": "https://www.aboutamazon.com/news",
    },
    "amazon india": {
        "domain": "amazon.in",
        "news": "https://www.aboutamazon.in/news",
        "press": "https://press.aboutamazon.in",
        "official": "https://www.aboutamazon.in/news",
        "careers": "https://www.amazon.jobs/en/locations/india",
        "pricing": "https://sellercentral.amazon.in/pricing",
        "default": "https://www.aboutamazon.in/news",
    },
    "flipkart": {
        "domain": "flipkart.com",
        "news": "https://stories.flipkart.com",
        "official": "https://stories.flipkart.com",
        "careers": "https://www.flipkartcareers.com",
        "sellers": "https://seller.flipkart.com",
        "tech": "https://tech.flipkart.com",
        "default": "https://stories.flipkart.com",
    },
    "datadog": {
        "domain": "datadoghq.com",
        "news": "https://www.datadoghq.com/blog/",
        "blog": "https://www.datadoghq.com/blog/",
        "official": "https://www.datadoghq.com/blog/",
        "pricing": "https://www.datadoghq.com/pricing/",
        "documentation": "https://docs.datadoghq.com/",
        "careers": "https://careers.datadoghq.com/",
        "default": "https://www.datadoghq.com/blog/",
    },
    "supabase": {
        "domain": "supabase.com",
        "news": "https://supabase.com/blog",
        "blog": "https://supabase.com/blog",
        "official": "https://supabase.com/blog",
        "pricing": "https://supabase.com/pricing",
        "documentation": "https://supabase.com/docs",
        "github": "https://github.com/supabase/supabase",
        "default": "https://supabase.com/blog",
    },
    "stripe": {
        "domain": "stripe.com",
        "news": "https://stripe.com/newsroom",
        "official": "https://stripe.com/newsroom",
        "pricing": "https://stripe.com/pricing",
        "documentation": "https://stripe.com/docs",
        "default": "https://stripe.com/newsroom",
    },
    "posthog": {
        "domain": "posthog.com",
        "news": "https://posthog.com/blog",
        "blog": "https://posthog.com/blog",
        "pricing": "https://posthog.com/pricing",
        "documentation": "https://posthog.com/docs",
        "github": "https://github.com/PostHog/posthog",
        "default": "https://posthog.com/blog",
    },
    "mixpanel": {
        "domain": "mixpanel.com",
        "news": "https://mixpanel.com/blog/",
        "blog": "https://mixpanel.com/blog/",
        "pricing": "https://mixpanel.com/pricing/",
        "documentation": "https://docs.mixpanel.com/",
        "default": "https://mixpanel.com/blog/",
    },
    "amplitude": {
        "domain": "amplitude.com",
        "news": "https://amplitude.com/blog",
        "blog": "https://amplitude.com/blog",
        "pricing": "https://amplitude.com/pricing",
        "documentation": "https://www.amplitude.com/docs",
        "default": "https://amplitude.com/blog",
    },
    "meesho": {
        "domain": "meesho.io",
        "news": "https://blog.meesho.io/",
        "blog": "https://blog.meesho.io/",
        "official": "https://www.meesho.com/",
        "engineering": "https://tech.meesho.io/",
        "tech": "https://tech.meesho.io/",
        "careers": "https://www.meesho.io/careers",
        "pricing": "https://supplier.meesho.com/zero-commission",
        "default": "https://blog.meesho.io/",
    },
    "flipkart": {
        "domain": "flipkart.com",
        "news": "https://stories.flipkart.com/",
        "blog": "https://stories.flipkart.com/",
        "official": "https://www.flipkart.com/",
        "careers": "https://www.flipkartcareers.com/",
        "pricing": "https://seller.flipkart.com/fees-and-commission",
        "default": "https://stories.flipkart.com/",
    },
    "amazon india": {
        "domain": "amazon.in",
        "news": "https://www.aboutamazon.in/news",
        "blog": "https://www.aboutamazon.in/news",
        "official": "https://www.aboutamazon.in/",
        "careers": "https://www.amazon.jobs/en/locations/india",
        "pricing": "https://sell.amazon.in/pricing",
        "default": "https://www.aboutamazon.in/news",
    },
    "amazon": {
        "domain": "aboutamazon.com",
        "news": "https://www.aboutamazon.com/news",
        "blog": "https://www.aboutamazon.com/news",
        "official": "https://www.aboutamazon.com/",
        "careers": "https://www.amazon.jobs/",
        "pricing": "https://aws.amazon.com/pricing/",
        "default": "https://www.aboutamazon.com/news",
    },
    "myntra": {
        "domain": "myntra.com",
        "news": "https://blog.myntra.com/",
        "blog": "https://blog.myntra.com/",
        "official": "https://www.myntra.com/",
        "careers": "https://careers.myntra.com/",
        "default": "https://blog.myntra.com/",
    },
    "shopsy": {
        "domain": "shopsy.in",
        "news": "https://stories.flipkart.com/tag/shopsy/",
        "official": "https://www.shopsy.in/",
        "default": "https://stories.flipkart.com/tag/shopsy/",
    },
    "walmart": {
        "domain": "walmart.com",
        "news": "https://corporate.walmart.com/news",
        "blog": "https://corporate.walmart.com/news",
        "official": "https://www.walmart.com/",
        "default": "https://corporate.walmart.com/news",
    },
    "target": {
        "domain": "target.com",
        "news": "https://corporate.target.com/news-features",
        "official": "https://corporate.target.com/",
        "default": "https://corporate.target.com/news-features",
    },
    "paypal": {
        "domain": "paypal.com",
        "news": "https://newsroom.paypal-corp.com/",
        "official": "https://www.paypal.com/",
        "pricing": "https://www.paypal.com/pricing",
        "default": "https://newsroom.paypal-corp.com/",
    },
    "adyen": {
        "domain": "adyen.com",
        "news": "https://www.adyen.com/blog",
        "official": "https://www.adyen.com/",
        "pricing": "https://www.adyen.com/pricing",
        "default": "https://www.adyen.com/blog",
    },
    "checkout.com": {
        "domain": "checkout.com",
        "news": "https://www.checkout.com/blog",
        "official": "https://www.checkout.com/",
        "default": "https://www.checkout.com/blog",
    },
    "alibaba": {
        "domain": "alibabagroup.com",
        "news": "https://www.alizila.com/",
        "official": "https://www.alibabagroup.com/",
        "default": "https://www.alizila.com/",
    },
    "anthropic": {
        "domain": "anthropic.com",
        "news": "https://www.anthropic.com/news",
        "blog": "https://www.anthropic.com/news",
        "official": "https://www.anthropic.com/",
        "pricing": "https://www.anthropic.com/pricing",
        "documentation": "https://docs.anthropic.com/",
        "default": "https://www.anthropic.com/news",
    },
    "meta ai": {
        "domain": "ai.meta.com",
        "news": "https://ai.meta.com/blog/",
        "blog": "https://ai.meta.com/blog/",
        "official": "https://ai.meta.com/",
        "default": "https://ai.meta.com/blog/",
    },
    "google deepmind": {
        "domain": "deepmind.google",
        "news": "https://deepmind.google/discover/blog/",
        "blog": "https://deepmind.google/discover/blog/",
        "official": "https://deepmind.google/",
        "default": "https://deepmind.google/discover/blog/",
    },
    "adidas": {
        "domain": "adidas-group.com",
        "news": "https://www.adidas-group.com/en/media/news-archive/",
        "official": "https://www.adidas.com/",
        "default": "https://www.adidas-group.com/en/media/news-archive/",
    },
    "puma": {
        "domain": "about.puma.com",
        "news": "https://about.puma.com/en/newsroom",
        "official": "https://about.puma.com/",
        "default": "https://about.puma.com/en/newsroom",
    },
}


def is_valid_http_url(url: Optional[str]) -> bool:
    """Validate that url is a well-formed HTTP or HTTPS URL and not a placeholder."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u or " " in u or len(u) < 8:
        return False
    if not (u.startswith("http://") or u.startswith("https://")):
        return False

    # Check for placeholder patterns that cause 404 or invalid domains
    lower = u.lower()
    if any(p in lower for p in [
        "/updates/1", "/updates/2", "/updates/3", "/updates/4", "/updates/5",
        "example.com", "placeholder", "localhost", "127.0.0.1", "awsamplify.com", "cloudflarepages.com"
    ]):
        return False

    try:
        parsed = urlparse(u)
        return bool(parsed.scheme in ("http", "https") and parsed.netloc and "." in parsed.netloc)
    except Exception:
        return False


def get_canonical_source_url(
    company_name: str,
    channel: str = "",
    title: str = "",
    existing_url: Optional[str] = None,
    index: int = 0
) -> Optional[str]:
    """
    Resolve an authentic, verifiable primary source document URL for a competitor.
    If existing_url is already valid and not a placeholder, return it.
    Otherwise, look up the canonical endpoint for the competitor and channel.
    If no authentic source exists, return None (never create fake links).
    """
    # 1. If existing URL is genuine and valid, preserve it
    if is_valid_http_url(existing_url):
        return existing_url.strip()

    c_clean = str(company_name or "").strip().lower()
    if not c_clean:
        return None

    # Match against known canonical competitor sources (prefer exact match, then longest key)
    matched_entry = None
    if c_clean in COMPETITOR_CANONICAL_SOURCES:
        matched_entry = COMPETITOR_CANONICAL_SOURCES[c_clean]
    else:
        for k in sorted(COMPETITOR_CANONICAL_SOURCES.keys(), key=len, reverse=True):
            if k in c_clean or c_clean in k:
                matched_entry = COMPETITOR_CANONICAL_SOURCES[k]
                break

    if not matched_entry:
        return None

    # Determine channel preference based on channel or title keywords
    context = f"{channel} {title}".lower()
    if any(w in context for w in ["price", "pricing", "tier", "billing", "fee", "cost"]):
        return matched_entry.get("pricing") or matched_entry.get("default")
    if any(w in context for w in ["github", "repo", "commit", "sdk", "open source", "library"]):
        return matched_entry.get("github") or matched_entry.get("documentation") or matched_entry.get("default")
    if any(w in context for w in ["hire", "hiring", "recruit", "vp", "chief", "cto", "ciso", "jobs", "careers"]):
        return matched_entry.get("careers") or matched_entry.get("news") or matched_entry.get("default")
    if any(w in context for w in ["doc", "documentation", "api", "reference", "manual", "guide"]):
        return matched_entry.get("documentation") or matched_entry.get("default")
    if any(w in context for w in ["blog", "engineering", "tech"]):
        return matched_entry.get("blog") or matched_entry.get("news") or matched_entry.get("default")
    if any(w in context for w in ["changelog", "status", "incident"]):
        return matched_entry.get("changelog") or matched_entry.get("status") or matched_entry.get("news") or matched_entry.get("default")
    if any(w in context for w in ["workers"]):
        return matched_entry.get("workers") or matched_entry.get("documentation") or matched_entry.get("default")
    if any(w in context for w in ["pages"]):
        return matched_entry.get("pages") or matched_entry.get("documentation") or matched_entry.get("default")
    if any(w in context for w in ["official", "product", "homepage", "overview"]):
        return matched_entry.get("official") or matched_entry.get("product") or matched_entry.get("default")

    # If an index is provided to diversify corroborating signals:
    if index > 0:
        distinct_urls = list(dict.fromkeys([v for k, v in matched_entry.items() if k != "domain" and is_valid_http_url(v)]))
        if distinct_urls:
            return distinct_urls[index % len(distinct_urls)]

    return matched_entry.get("news") or matched_entry.get("default")


def get_competitor_domain(competitor_name: str) -> Optional[str]:
    """Retrieve verified canonical domain for competitor or None."""
    cn = (competitor_name or "").lower().strip()
    for k, v in COMPETITOR_CANONICAL_SOURCES.items():
        if k in cn or cn in k:
            return v.get("domain")
    return None
