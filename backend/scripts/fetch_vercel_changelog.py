import urllib.request
import ssl
import re

ctx = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PrismIQ/1.0'
}
req = urllib.request.Request('https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard', headers=headers)
with urllib.request.urlopen(req, context=ctx) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

# Extract meta description
m_desc = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
if not m_desc:
    m_desc = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)

print('Meta description:', m_desc.group(1) if m_desc else 'None')

# Check title
m_title = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
print('Title:', m_title.group(1) if m_title else 'None')
