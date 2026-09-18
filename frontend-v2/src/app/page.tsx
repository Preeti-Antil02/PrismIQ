"use client";

import { useEffect } from "react";
import "../app/public-website.css";
import { PublicNav } from "@/components/public/PublicNav";
import { HeroSection } from "@/components/public/HeroSection";
import { WhySection } from "@/components/public/WhySection";
import { HowSection } from "@/components/public/HowSection";
import { ProductSection } from "@/components/public/ProductSection";
import { ResearchSection } from "@/components/public/ResearchSection";
import { CtaSection } from "@/components/public/CtaSection";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function PublicWebsite() {
  useEffect(() => {
    // IntersectionObserver for .ps-reveal scroll animations
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("ps-visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".ps-reveal").forEach((el) => obs.observe(el));

    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="public-site"
      style={{
        /* Override the dark body styles from the root layout for this page */
        background:
          "radial-gradient(circle at 8% 7%, rgba(139,114,255,0.12), transparent 28rem), radial-gradient(circle at 92% 15%, rgba(114,215,232,0.13), transparent 30rem), radial-gradient(circle at 55% 58%, rgba(244,168,202,0.08), transparent 34rem), #fbfaf8",
        color: "#17171b",
        minHeight: "100vh",
      }}
    >
      <PublicNav />
      <main id="top">
        <HeroSection />
        <WhySection />
        <HowSection />
        <ProductSection />
        <ResearchSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </div>
  );
}
