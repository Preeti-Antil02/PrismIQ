export function ResearchSection() {
  return (
    <section id="research" className="ps-section">
      <div className="ps-wrap">
        <div className="ps-head ps-reveal">
          <span className="ps-eyebrow">A system, not a collection of pages</span>
          <h2>
            Every surface has a <span className="ps-gradient">job.</span>
          </h2>
          <p>
            Keep the public website spacious, then let each product capability tell one
            focused story.
          </p>
        </div>
        <div className="ps-showcase">
          {/* Large card — Overview */}
          <article className="ps-card ps-large ps-reveal">
            <span className="ps-eyebrow">Overview</span>
            <h3>A quiet command center for attention.</h3>
            <p>
              Movement, emerging research and recent events are prioritized into a readable
              decision surface.
            </p>
            <div className="ps-dash">
              <div style={{ fontSize: 11, color: "#9b9ba3" }}>PRISMIQ / OVERVIEW</div>
              <div className="ps-dashGrid">
                <div className="ps-dashBox">
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    What deserves your attention
                  </div>
                  <div className="ps-dashLine" style={{ width: "82%" }} />
                  <div className="ps-dashLine" style={{ width: "57%" }} />
                  <div className="ps-dashLine" style={{ width: "71%" }} />
                </div>
                <div className="ps-dashBox">
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Competitive movement</div>
                  <div className="ps-dashLine" style={{ width: "57%" }} />
                  <div className="ps-dashLine" style={{ width: "82%" }} />
                  <div className="ps-dashLine" style={{ width: "71%" }} />
                </div>
              </div>
            </div>
          </article>

          {/* Events card */}
          <article className="ps-card ps-reveal">
            <span className="ps-eyebrow">Events</span>
            <h3>Evidence behind every event.</h3>
            <p>
              Chronological intelligence that lets a user move from a concise event to the
              underlying evidence.
            </p>
            <div style={{ marginTop: 30 }}>
              <div className="ps-event">
                <i />
                <div>
                  <b>Product launch detected</b>
                  <small>Consolidated from multiple sources.</small>
                </div>
                <small>2h</small>
              </div>
              <div className="ps-event">
                <i />
                <div>
                  <b>Infrastructure movement</b>
                  <small>New evidence cluster.</small>
                </div>
                <small>5h</small>
              </div>
              <div className="ps-event">
                <i />
                <div>
                  <b>Pricing change</b>
                  <small>Source-backed update.</small>
                </div>
                <small>1d</small>
              </div>
            </div>
          </article>

          {/* Research card */}
          <article className="ps-card ps-reveal">
            <span className="ps-eyebrow">Research</span>
            <h3>See themes before they become obvious.</h3>
            <p>
              Explore company-related research and emerging themes separately from the
              competitive event stream.
            </p>
            <div className="ps-orbit">
              <div className="ps-orbitDot" />
              <div className="ps-orbitCore">Research</div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
