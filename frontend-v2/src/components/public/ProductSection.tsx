"use client";

import { useState } from "react";

const modes: Record<string, [string, string, string, string]> = {
  overview: [
    "Attention layer",
    "What deserves your attention.",
    "A calm overview of the movements, emerging research and recent events that matter to your monitored landscape.",
    "PrismIQ / Overview",
  ],
  signals: [
    "Evidence exploration",
    "Explore the signal behind the story.",
    "Move from a surfaced signal into the evidence, source context and related activity behind it.",
    "PrismIQ / Signals",
  ],
  events: [
    "Event intelligence",
    "Know what actually happened.",
    "Chronological events consolidate related source activity into readable, evidence-backed intelligence.",
    "PrismIQ / Events",
  ],
  research: [
    "Emerging research",
    "Follow themes, not just competitors.",
    "Explore company-related research and emerging themes separately from the competitive event stream.",
    "PrismIQ / Research",
  ],
};

export function ProductSection() {
  const [active, setActive] = useState("overview");
  const m = modes[active];

  return (
    <section id="product" className="ps-section">
      <div className="ps-wrap">
        <div className="ps-head ps-reveal">
          <span className="ps-eyebrow">Product in motion</span>
          <h2>
            Don&apos;t explain intelligence with a screenshot.{" "}
            <span className="ps-gradient">Let people explore it.</span>
          </h2>
          <p>
            Interactive product storytelling: the visitor sees the workflow before being asked
            to commit.
          </p>
        </div>
        <div className="ps-interactive ps-reveal">
          <div className="ps-tabs">
            {Object.keys(modes).map((key) => (
              <button
                key={key}
                className={`ps-tab${active === key ? " ps-active" : ""}`}
                onClick={() => setActive(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <div className="ps-demoPanel">
            <div className="ps-info">
              <span className="ps-eyebrow">{m[0]}</span>
              <h3>{m[1]}</h3>
              <p>{m[2]}</p>
            </div>
            <div className="ps-intel">
              <div className="ps-uiHead">
                <strong>{m[3]}</strong>
                <div className="ps-dots">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="ps-chart">
                <span className="ps-bar" style={{ height: "34%" }} />
                <span className="ps-bar" style={{ height: "48%" }} />
                <span className="ps-bar" style={{ height: "42%" }} />
                <span className="ps-bar" style={{ height: "67%" }} />
                <span className="ps-bar" style={{ height: "58%" }} />
                <span className="ps-bar" style={{ height: "84%" }} />
                <span className="ps-bar" style={{ height: "72%" }} />
              </div>
              <div>
                <div className="ps-feedRow">
                  <i />
                  <div>
                    <b>Competitor movement detected</b>
                    <span> · Product update · 2h ago</span>
                  </div>
                  <strong>High</strong>
                </div>
                <div className="ps-feedRow">
                  <i />
                  <div>
                    <b>Emerging research theme</b>
                    <span> · 6 sources · today</span>
                  </div>
                  <strong>Med</strong>
                </div>
                <div className="ps-feedRow">
                  <i />
                  <div>
                    <b>Infrastructure event</b>
                    <span> · Evidence consolidated</span>
                  </div>
                  <strong>New</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
