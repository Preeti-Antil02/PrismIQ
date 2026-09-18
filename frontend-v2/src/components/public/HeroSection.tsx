import { HeroDashboard } from "./HeroDashboard";

export function HeroSection() {
  return (
    <section className="ps-hero">
      {/* Soft chromatic background ambient lighting */}
      <div className="ps-heroLight ps-heroLightA" />
      <div className="ps-heroLight ps-heroLightB" />
      <div className="ps-heroLight ps-heroLightC" />

      <div className="ps-wrap ps-heroExact">
        {/* Prism Area */}
        <div className="ps-heroPrismArea ps-reveal">
          {/* Chromatic refracted light rays */}
          <div className="ps-heroRay ps-ray1" />
          <div className="ps-heroRay ps-ray2" />
          <div className="ps-heroRay ps-ray3" />
          <div className="ps-heroRay ps-ray4" />
          <div className="ps-heroRay ps-ray5" />

          {/* 3D Multi-faceted Prism */}
          <div className="ps-heroPrism">
            <svg viewBox="0 0 260 230" role="img" aria-label="3D PrismIQ prism">
              <defs>
                <linearGradient id="pBlue" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#5C75FF" />
                  <stop offset=".48" stopColor="#4E7DFF" />
                  <stop offset="1" stopColor="#4BD4F0" />
                </linearGradient>
                <linearGradient id="pViolet" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#7A5CFF" />
                  <stop offset=".52" stopColor="#A04BFF" />
                  <stop offset="1" stopColor="#E64ED5" />
                </linearGradient>
                <linearGradient id="pPink" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#FFB5D9" />
                  <stop offset=".38" stopColor="#FF72C8" />
                  <stop offset="1" stopColor="#9B55FF" />
                </linearGradient>
                <linearGradient id="pCyan" x1="0" y1="0" x2="0.9" y2="1">
                  <stop stopColor="#F2FFFF" />
                  <stop offset=".45" stopColor="#72EBF8" />
                  <stop offset="1" stopColor="#4A75FF" />
                </linearGradient>
                <linearGradient id="pWhite" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#FFFFFF" stopOpacity=".95" />
                  <stop offset="1" stopColor="#DDFBFF" stopOpacity=".08" />
                </linearGradient>
                <filter id="pGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="11" />
                </filter>
                <filter id="pSoft" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" />
                </filter>
              </defs>

              {/* Diffuse purple/pink backlight glow */}
              <path d="M130 12 L224 181 L130 214 L36 181 Z" fill="#8C6BFF" opacity=".22" filter="url(#pGlow)" />

              {/* Left face - brilliant cyan to blue */}
              <path d="M130 10 L130 163 L36 181 Z" fill="url(#pCyan)" opacity=".96" />

              {/* Right face - luminous royal violet to purple */}
              <path d="M130 10 L224 181 L130 163 Z" fill="url(#pViolet)" opacity=".98" />

              {/* Bottom facet - warm glowing magenta pink */}
              <path d="M130 163 L224 181 L130 214 Z" fill="url(#pPink)" opacity=".92" />

              {/* Inner facet specular highlights */}
              <path d="M130 10 L169 82 L130 163 Z" fill="url(#pWhite)" opacity=".6" />
              <path d="M130 10 L91 82 L130 163 Z" fill="#FFFFFF" opacity=".22" />
              <path d="M130 163 L91 171 L130 214 Z" fill="#E6FFFF" opacity=".25" />
              <path d="M130 10 L224 181 L130 163 Z" fill="#FFA3DC" opacity=".2" />
              <path d="M130 10 L36 181 L130 163 Z" fill="#4BCFFF" opacity=".2" />

              {/* Crisp white facet ridge highlights */}
              <path d="M130 10 L130 163" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.4" />
              <path d="M130 163 L36 181 M130 163 L224 181" stroke="#FFFFFF" strokeOpacity=".6" strokeWidth="1.2" />

              {/* Radiant pink glow under core */}
              <ellipse cx="130" cy="153" rx="72" ry="26" fill="#FF7BD4" opacity=".28" filter="url(#pSoft)" />
            </svg>
          </div>

          {/* Floating crystal shards */}
          <span className="ps-heroShard ps-shard1" />
          <span className="ps-heroShard ps-shard2" />
          <span className="ps-heroShard ps-shard3" />
          <span className="ps-heroShard ps-shard4" />

          {/* 10 Floating Information Pills with sharp SVGs matching reference image */}
          {/* 1. Real-time events (top far-left) */}
          <div className="ps-heroPill ps-p1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#f43f5e" className="ps-pillIcon">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Real-time events</span>
          </div>

          {/* 2. Deep research (mid far-left) */}
          <div className="ps-heroPill ps-p2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.6" className="ps-pillIcon">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Deep research</span>
          </div>

          {/* 3. Market trends (top-left of prism) */}
          <div className="ps-heroPill ps-p3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0d9488" className="ps-pillIcon">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
            <span>Market trends</span>
          </div>

          {/* 4. Competitive analysis (top-right of prism) */}
          <div className="ps-heroPill ps-p4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7c3aed" className="ps-pillIcon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Competitive analysis</span>
          </div>

          {/* 5. Strategic insights (top right) */}
          <div className="ps-heroPill ps-p5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.6" className="ps-pillIcon">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
            </svg>
            <span>Strategic insights</span>
          </div>

          {/* 6. Signals & sentiment (mid right) */}
          <div className="ps-heroPill ps-p6">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#0d9488" className="ps-pillIcon">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Signals &amp; sentiment</span>
          </div>

          {/* 7. Industry news (lower right) */}
          <div className="ps-heroPill ps-p7">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" className="ps-pillIcon">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <line x1="8" y1="8" x2="16" y2="8" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="8" y1="16" x2="12" y2="16" />
            </svg>
            <span>Industry news</span>
          </div>

          {/* 8. Pricing & packaging (bottom right) */}
          <div className="ps-heroPill ps-p8">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c026d3" strokeWidth="2.5" className="ps-pillIcon">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="#c026d3" />
            </svg>
            <span>Pricing &amp; packaging</span>
          </div>

          {/* 9. Product launches (bottom far-left) */}
          <div className="ps-heroPill ps-p9">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#0891b2" className="ps-pillIcon">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <span>Product launches</span>
          </div>

          {/* 10. AI research (lower left-center) */}
          <div className="ps-heroPill ps-p10">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2.5" className="ps-pillIcon">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="8" y="8" width="8" height="8" fill="#9333ea" />
            </svg>
            <span>AI research</span>
          </div>
        </div>

        {/* Hero Center Text — exact lines from HTML reference */}
        <div className="ps-heroCenter ps-reveal">
          <h2 className="ps-heroHeadline">
            Turn scattered signals into clear <br />intelligence.
          </h2>

          <p className="ps-heroSub">
            Monitor competitors, track what matters, and get ahead with real-time events,
            <br className="ps-desktopOnly" /> deep research and AI-powered insights.
          </p>

          <div className="ps-heroActions">
            <a className="ps-btn ps-btn-grad ps-hero-cta-btn" href="/signup">
              Get started free →
            </a>
            <a className="ps-btn ps-btn-light ps-hero-demo-btn" href="#product">
              ◉ &nbsp;Watch demo
            </a>
          </div>
        </div>

        {/* Dashboard Preview */}
        <HeroDashboard />
      </div>
    </section>
  );
}
