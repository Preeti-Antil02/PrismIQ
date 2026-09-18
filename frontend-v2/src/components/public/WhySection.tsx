export function WhySection() {
  return (
    <section id="why" className="ps-section">
      <div className="ps-wrap">
        <div className="ps-head ps-reveal">
          <span className="ps-eyebrow">The problem</span>
          <h2>
            Important signals are everywhere.{" "}
            <span className="ps-gradient">Context isn&apos;t.</span>
          </h2>
          <p>
            Teams already have news, releases, GitHub activity, research, websites and internal
            notes. The hard part is knowing what actually changed, why it matters, and what
            deserves attention.
          </p>
        </div>
        <div className="ps-two">
          <div className="ps-copy ps-reveal">
            <h3>PrismIQ is the layer between raw signals and decisions.</h3>
            <p>
              Instead of another stream of alerts, PrismIQ organizes evidence around companies,
              movements and emerging themes so a team can move from discovery to understanding
              without manually stitching the story together.
            </p>
          </div>
          <div className="ps-noise ps-reveal">
            <div className="ps-noiseRow">
              <span className="ps-icon">01</span>
              <span className="ps-label">News</span>
              <span className="ps-line" />
            </div>
            <div className="ps-noiseRow">
              <span className="ps-icon">02</span>
              <span className="ps-label">Product</span>
              <span className="ps-line ps-short" />
            </div>
            <div className="ps-noiseRow">
              <span className="ps-icon">03</span>
              <span className="ps-label">Research</span>
              <span className="ps-line" />
            </div>
            <div className="ps-noiseRow">
              <span className="ps-icon">04</span>
              <span className="ps-label">GitHub</span>
              <span className="ps-line ps-short" />
            </div>
            <div className="ps-noiseRow">
              <span className="ps-icon">05</span>
              <span className="ps-label">Web</span>
              <span className="ps-line" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
