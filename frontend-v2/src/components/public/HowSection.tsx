export function HowSection() {
  return (
    <section id="how" className="ps-section">
      <div className="ps-wrap">
        <div className="ps-head ps-reveal">
          <span className="ps-eyebrow">How PrismIQ works</span>
          <h2>
            From a company name to a{" "}
            <span className="ps-gradient">living intelligence map.</span>
          </h2>
          <p>
            Make the product journey the story. Each step gets its own space, visual and
            interaction instead of compressing the entire pitch into one screen.
          </p>
        </div>
        <div className="ps-workflow">
          <div className="ps-wline" />

          {/* Step 1 */}
          <article className="ps-step ps-reveal">
            <div className="ps-num">01</div>
            <div>
              <h3>Start with one company.</h3>
              <p>
                Tell PrismIQ what you want to understand. The workspace begins with a company,
                not a maze of configuration screens.
              </p>
            </div>
            <div className="ps-demo">
              <div className="ps-demoTop">
                <span>New workspace</span>
                <span>1 / 3</span>
              </div>
              <div className="ps-mini">
                <strong>Company</strong>
                <span>Enter the company you want to monitor.</span>
              </div>
              <div className="ps-mini">
                <strong>cloudflare.com</strong>
                <span>Cloud infrastructure · SaaS</span>
              </div>
              <button className="ps-btn ps-btn-grad" style={{ width: "100%" }}>
                Continue →
              </button>
            </div>
          </article>

          {/* Step 2 */}
          <article className="ps-step ps-reveal">
            <div className="ps-num">02</div>
            <div>
              <h3>Let PrismIQ map the landscape.</h3>
              <p>
                Discovery brings together potential competitors and related signals. The user
                stays in control of what becomes part of the workspace.
              </p>
            </div>
            <div className="ps-demo">
              <div className="ps-demoTop">
                <span>Competitive landscape</span>
                <span>12 found</span>
              </div>
              <div className="ps-mini">
                <strong>Vercel</strong>
                <span>Similar product category · infrastructure overlap</span>
                <span className="ps-tag">Track</span>
              </div>
              <div className="ps-mini">
                <strong>Netlify</strong>
                <span>Adjacent platform · developer ecosystem overlap</span>
                <span className="ps-tag">Track</span>
              </div>
              <div className="ps-progress">
                <i />
              </div>
            </div>
          </article>

          {/* Step 3 */}
          <article className="ps-step ps-reveal">
            <div className="ps-num">03</div>
            <div>
              <h3>Follow what deserves attention.</h3>
              <p>
                Once configured, the product becomes a daily intelligence surface: movement,
                research, events and evidence in one place.
              </p>
            </div>
            <div className="ps-demo">
              <div className="ps-demoTop">
                <span>Workspace ready</span>
                <span>Live</span>
              </div>
              <div className="ps-mini">
                <strong>3 competitors tracked</strong>
                <span>Competitive movement is being monitored.</span>
              </div>
              <div className="ps-mini">
                <strong>Research feed ready</strong>
                <span>Emerging topics appear as evidence accumulates.</span>
              </div>
              <button className="ps-btn ps-btn-dark" style={{ width: "100%" }}>
                Open PrismIQ →
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
