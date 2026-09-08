import requests
import re
from src import research_classifier

headers = {'User-Agent': 'PrismIQ-ResearchMonitor/1.0', 'Accept': 'text/markdown, text/html'}

def _fetch_article_content_fallback(url: str) -> str:
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            text = r.text
            # If HTML, extract article/main or meta description
            if "<html" in text.lower():
                # Try meta description first
                m_desc = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', text, re.IGNORECASE)
                meta_desc = m_desc.group(1) if m_desc else ""
                
                # Extract main or article content
                m_art = re.search(r'<(?:article|main)[^>]*>(.*?)</(?:article|main)>', text, re.DOTALL | re.IGNORECASE)
                body = m_art.group(1) if m_art else text
                clean_body = re.sub(r'<[^>]+>', ' ', body)
                clean_body = re.sub(r'\s+', ' ', clean_body).strip()
                return f"{meta_desc}. {clean_body[:2000]}".strip()
            else:
                return text[:2000].strip()
    except Exception as ex:
        print(f"Error fetching fallback for {url}: {ex}")
    return ""

test_urls = [
    # 1. Ambiguous Vercel engineering post with truncated summary
    ("Compute that takes any shape", "...", "https://vercel.com/blog/fluid-compute-takes-any-shape"),
    # 2. Vercel changelog items (short descriptions)
    ("Gemini 3.8 Flash now available on AI Gateway", "...", "https://vercel.com/changelog/gemini-3-8-flash-now-available-on-ai-gateway"),
    ("GLM-5.3 is 50% off through DigitalOcean on AI Gateway", "...", "https://vercel.com/changelog/glm-5-3-is-50-off-through-digitalocean-on-ai-gateway"),
    ("Free domain with Pro offer now includes .app and .dev", "...", "https://vercel.com/changelog/app-and-dev-domains-included-with-free-domain-for-pro"),
    # 3. Netlify marketing/UI items
    ("Build with Netlify came to Atlanta", "What happened when we brought Netlify to Atlanta", "https://www.netlify.com/blog/build-with-netlify-came-to-atlanta"),
    ("Compete in OpenAI's WebMCP Challenge with Netlify", "Join the OpenAI WebMCP Challenge", "https://www.netlify.com/blog/compete-openai-webmcp-challenge"),
]

print("=== TESTING TARGETED FULL-CONTENT FALLBACK ===")
for title, summary, url in test_urls:
    if len(summary.strip()) < 80 or summary.strip() == "...":
        content = _fetch_article_content_fallback(url)
        content_to_use = content if content else summary
        used_fallback = True
    else:
        content_to_use = summary
        used_fallback = False
        
    is_res, reason, indicators = research_classifier.classify_research_content(title, content_to_use, url=url, source="blog")
    status = "RESEARCH" if is_res else "ROUTINE"
    print(f"\nTitle: {title}")
    print(f"  URL: {url}")
    print(f"  Used Fallback: {used_fallback} (content len: {len(content_to_use)})")
    print(f"  Classified: {status}")
    print(f"  Reason: {reason}")
    print(f"  Indicators: {indicators}")
