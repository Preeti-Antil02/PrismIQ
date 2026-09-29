"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export function CtaSection() {
  const { user, onboardingComplete } = useAuth();
  const targetHref = user ? (onboardingComplete ? "/app" : "/onboarding") : "/signup";
  const ctaLabel = user ? (onboardingComplete ? "Go to Workspace →" : "Continue Setup →") : "Create my workspace →";

  return (
    <section id="start" className="ps-cta">
      <div className="ps-wrap">
        <div className="ps-ctaCard ps-reveal">
          <span className="ps-eyebrow">Start with one company</span>
          <h2>Turn scattered signals into a clearer picture.</h2>
          <p>
            Configure your first PrismIQ workspace and let the intelligence layer build around
            the market you care about.
          </p>
          <Link className="ps-btn ps-btn-grad" href={targetHref}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
