export function HeroDashboard() {
  return (
    <div className="ps-heroDashboard ps-reveal">
      {/* Left Sidebar */}
      <div className="ps-dashNav">
        <div className="ps-dashBrand">
          <svg viewBox="0 0 42 42" style={{ width: 22, height: 22, flexShrink: 0 }}>
            <defs>
              <linearGradient id="dbA" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#5A72FF" />
                <stop offset=".52" stopColor="#8B4DFF" />
                <stop offset="1" stopColor="#FF83C8" />
              </linearGradient>
            </defs>
            <path d="M21 3 37 31 21 39 5 31Z" fill="url(#dbA)" />
            <path d="M21 3 21 39 5 31Z" fill="#62DDF2" opacity=".85" />
            <path d="M21 26 37 31 21 39Z" fill="#FF72C2" opacity=".6" />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 13, color: "#17171b", letterSpacing: "-0.02em" }}>PrismIQ</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", cursor: "pointer" }}>⟨</span>
        </div>

        <div className="ps-dashSideList">
          <div className="ps-dashSideItem ps-dashSideActive">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Overview
          </div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l3 9 4-18 3 9h6" />
            </svg>
            Signals
          </div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Events
          </div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Research
          </div>

          <div className="ps-dashSideSection">COMPETITIVE</div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Competitors
          </div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Compare
          </div>

          <div className="ps-dashSideSection">INTELLIGENCE</div>
          <div className="ps-dashSideItem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
            Market Radar
          </div>
        </div>
      </div>

      {/* Main Dashboard Surface */}
      <div className="ps-dashMain">
        {/* Top Bar */}
        <div className="ps-dashTop">
          <div>
            <b>Overview</b>
            <small>A real-time view of what&apos;s happening in your competitive landscape.</small>
          </div>
          <button className="ps-dashDateBtn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Last 30 days ⌄
          </button>
        </div>

        {/* 4 Cards Row */}
        <div className="ps-metricRow">
          {/* Stat Card 1 */}
          <div className="ps-metric">
            <div className="ps-metricHeader">
              <span className="ps-metricIconBadge ps-badgeBlue">💎 2</span>
            </div>
            <b>425</b>
            <div className="ps-metricFooter">
              <span>Consolidated events</span>
              <span className="ps-metricChange ps-changeGreen">+ 12%</span>
            </div>
          </div>

          {/* Stat Card 2 */}
          <div className="ps-metric">
            <div className="ps-metricHeader">
              <span className="ps-metricIconBadge ps-badgePurple">👥 23</span>
            </div>
            <b>23</b>
            <div className="ps-metricFooter">
              <span>Tracked competitors</span>
              <span className="ps-metricChange ps-changeGreen">+ 4%</span>
            </div>
          </div>

          {/* Stat Card 3 */}
          <div className="ps-metric">
            <div className="ps-metricHeader">
              <span className="ps-metricIconBadge ps-badgeIndigo">👍 7</span>
            </div>
            <b>18</b>
            <div className="ps-metricFooter">
              <span>Key opportunities</span>
              <span className="ps-metricChange ps-changeGreen">+ 2%</span>
            </div>
          </div>

          {/* Stat Card 4: Competitive Activity Area Chart */}
          <div className="ps-activity">
            <div className="ps-activityTop">
              <div>
                <b>Competitive Activity</b>
                <span className="ps-activitySub">Event volume across tracked competitors</span>
              </div>
              <span className="ps-metricChange ps-changeGreen" style={{ alignSelf: "flex-start" }}>+ 18%</span>
            </div>
            {/* SVG Curvy Area Chart matching reference */}
            <div className="ps-chartSvgWrap">
              <svg viewBox="0 0 200 48" className="ps-waveChart" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartWaveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="chartWavePink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Magenta lower wave fill & line */}
                <path
                  d="M0,38 C25,40 50,32 75,34 C100,36 125,28 150,22 C175,18 190,26 200,20 L200,48 L0,48 Z"
                  fill="url(#chartWavePink)"
                />
                <path
                  d="M0,38 C25,40 50,32 75,34 C100,36 125,28 150,22 C175,18 190,26 200,20"
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Blue/Cyan upper wave fill & line */}
                <path
                  d="M0,30 C30,34 50,18 80,24 C110,30 135,12 165,16 C180,18 192,8 200,10 L200,48 L0,48 Z"
                  fill="url(#chartWaveGrad)"
                />
                <path
                  d="M0,30 C30,34 50,18 80,24 C110,30 135,12 165,16 C180,18 192,8 200,10"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="165" cy="16" r="2.5" fill="#6366f1" />
                <circle cx="80" cy="24" r="2" fill="#38bdf8" />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Split Row */}
        <div className="ps-dashBottom">
          {/* Latest Events Column */}
          <div className="ps-latest">
            <div className="ps-colHeader">
              <b>Latest Events</b>
              <span className="ps-viewAllLink">View all →</span>
            </div>
            <div className="ps-dashEventsList">
              {/* Event 1 */}
              <div className="ps-dashEventRow">
                <span className="ps-eventDot" />
                <span className="ps-companyIcon ps-cfIcon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                  </svg>
                </span>
                <div className="ps-eventContent">
                  <div className="ps-eventMeta">
                    <span className="ps-eventCompany">Cloudflare Pages/Workers</span>
                    <span className="ps-eventTag ps-tagSecurity">SECURITY &amp; AUTH</span>
                    <span className="ps-eventTime">5d ago</span>
                  </div>
                  <div className="ps-eventTitle">1.1.1.1 now supports post-quantum DNSSEC, all 2,420 bytes of it</div>
                </div>
              </div>

              {/* Event 2 */}
              <div className="ps-dashEventRow">
                <span className="ps-eventDot" />
                <span className="ps-companyIcon ps-cfIcon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                  </svg>
                </span>
                <div className="ps-eventContent">
                  <div className="ps-eventMeta">
                    <span className="ps-eventCompany">Cloudflare Pages/Workers</span>
                    <span className="ps-eventTag ps-tagSecurity">SECURITY &amp; AUTH</span>
                    <span className="ps-eventTime">6d ago</span>
                  </div>
                  <div className="ps-eventTitle">Automatic Key Exchange: faster, post-quantum secure origin handshakes for 45 billion daily connections (and counting)</div>
                </div>
              </div>

              {/* Event 3 */}
              <div className="ps-dashEventRow">
                <span className="ps-eventDot" />
                <span className="ps-companyIcon ps-cfIcon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                  </svg>
                </span>
                <div className="ps-eventContent">
                  <div className="ps-eventMeta">
                    <span className="ps-eventCompany">Cloudflare Pages/Workers</span>
                    <span className="ps-eventTag ps-tagProduct">PRODUCT &amp; LAUNCH</span>
                    <span className="ps-eventTime">13d ago</span>
                  </div>
                  <div className="ps-eventTitle">How we could save petabytes of cache storage with Zstandard and Pingora</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Competitors Column */}
          <div className="ps-competitors">
            <div className="ps-colHeader">
              <b>Top Competitors</b>
            </div>
            <div className="ps-competitorsList">
              {/* Competitor 1 */}
              <div className="ps-compRow">
                <span className="ps-compLogo ps-compCf">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                  </svg>
                </span>
                <span className="ps-compName">Cloudflare</span>
                <div className="ps-compBarTrack">
                  <div className="ps-compBarFill" style={{ width: "85%" }} />
                </div>
                <span className="ps-compCount">218</span>
              </div>

              {/* Competitor 2 */}
              <div className="ps-compRow">
                <span className="ps-compLogo ps-compVercel">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#17171b">
                    <polygon points="12 2 22 20 2 20" />
                  </svg>
                </span>
                <span className="ps-compName">Vercel</span>
                <div className="ps-compBarTrack">
                  <div className="ps-compBarFill" style={{ width: "55%" }} />
                </div>
                <span className="ps-compCount">146</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <span className="ps-viewAllLink">View all →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
