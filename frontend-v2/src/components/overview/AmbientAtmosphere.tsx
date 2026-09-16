"use client";

import * as React from "react";

export function AmbientAtmosphere() {
  const prismRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Check reduced motion preference
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        if (!prismRef.current) return;
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        prismRef.current.style.transform = `translate(${x * -18}px, ${y * -10}px) rotate(${x * 2}deg)`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="absolute inset-0 top-0 h-[920px] overflow-hidden pointer-events-none select-none z-0" aria-hidden="true">
      {/* Orb 1: Violet to Magenta drift */}
      <div
        className="absolute rounded-full blur-[70px] opacity-[0.22] mix-blend-screen w-[500px] h-[260px] right-[5%] top-0"
        style={{
          background: "linear-gradient(90deg, var(--violet), var(--magenta))",
          animation: "drift 11s ease-in-out infinite alternate",
        }}
      />

      {/* Orb 2: Cyan ambient float */}
      <div
        className="absolute rounded-full blur-[70px] opacity-[0.11] mix-blend-screen w-[360px] h-[240px] right-[28%] top-[50px]"
        style={{
          background: "var(--cyan)",
          animation: "drift2 14s ease-in-out infinite alternate",
        }}
      />

      {/* Orb 3: Magenta lower accent */}
      <div
        className="absolute rounded-full blur-[70px] opacity-[0.12] mix-blend-screen w-[300px] h-[500px] left-[-100px] top-[900px]"
        style={{
          background: "var(--magenta)",
          animation: "drift3 17s ease-in-out infinite alternate",
        }}
      />

      {/* Signature Prism with Conic Reflection and Spectrum Ray */}
      <div
        ref={prismRef}
        className="prism absolute right-[7%] top-[10px] w-[440px] h-[230px] opacity-[0.42] transition-transform duration-300 ease-out"
        style={{
          background:
            "conic-gradient(from 205deg at 50% 50%, transparent 0 25%, rgba(155,92,255,0.3), rgba(39,228,208,0.25), transparent 53% 100%)",
          clipPath: "polygon(56% 0, 100% 100%, 0 100%)",
          filter: "blur(0.2px)",
          animation: "prismDrift 9s ease-in-out infinite alternate",
        }}
      >
        {/* Spectrum line ray crossing the prism */}
        <div
          className="absolute left-[-40%] top-[48%] w-[180%] h-[1px] -rotate-9"
          style={{
            background: "linear-gradient(90deg, transparent, var(--cyan), var(--magenta), var(--amber), transparent)",
            boxShadow: "0 0 24px 5px rgba(155,92,255,0.3)",
          }}
        />
      </div>

      {/* Distributed subtle color particles */}
      <div
        className="color-particle fixed w-1.5 h-1.5 rounded-full blur-[0.3px] opacity-[0.18]"
        style={{
          left: "12%",
          top: "18%",
          background: "var(--violet)",
          animation: "drift 14s ease-in-out infinite alternate",
        }}
      />
      <div
        className="color-particle fixed w-1.5 h-1.5 rounded-full blur-[0.3px] opacity-[0.18]"
        style={{
          right: "15%",
          top: "45%",
          background: "var(--cyan)",
          animation: "drift2 16s ease-in-out infinite alternate",
        }}
      />
      <div
        className="color-particle fixed w-1.5 h-1.5 rounded-full blur-[0.3px] opacity-[0.18]"
        style={{
          left: "20%",
          top: "75%",
          background: "var(--magenta)",
          animation: "drift3 18s ease-in-out infinite alternate",
        }}
      />
      <div
        className="color-particle fixed w-1.5 h-1.5 rounded-full blur-[0.3px] opacity-[0.18]"
        style={{
          right: "22%",
          top: "85%",
          background: "var(--amber)",
          animation: "drift 20s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
