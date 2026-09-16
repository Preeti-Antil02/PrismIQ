import * as React from "react";
import { cn } from "@/lib/utils";

export type CompanyName = "Stripe" | "Cloudflare" | "Vercel" | "Adyen" | "Netlify" | string;

interface CompanyLogoProps {
  company: CompanyName;
  variant?: "hero" | "mini" | "inline";
  accentColor?: string;
  className?: string;
  showName?: boolean;
}

/**
 * Embedded SVG vectors for recognized company identities.
 * Pure vector paths, zero external network requests, pixel-perfect at all DPRs.
 */
function CompanyVector({ company, className }: { company: string; className?: string }) {
  const norm = company.toLowerCase().trim();

  if (norm.includes("stripe")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-white shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697.43 12.522.43 7.037.43 3.125 3.39 3.125 7.632c0 4.241 3.518 5.673 6.942 6.892 2.378.831 3.197 1.48 3.197 2.457 0 .977-.847 1.48-2.228 1.48-2.203 0-5.172-1.008-6.964-2.097l-.922 5.567c1.782.956 4.887 1.638 7.886 1.638 5.69 0 9.839-2.775 9.839-7.234 0-4.437-3.568-5.834-6.899-7.187z" />
      </svg>
    );
  }

  if (norm.includes("cloudflare")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#F38020] shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M18.23 9.09a5.9 5.9 0 0 0-5.59-3.95 6.04 6.04 0 0 0-5.83 4.41A4.7 4.7 0 0 0 2.2 14.1a4.67 4.67 0 0 0 4.69 4.65h11.23a4.07 4.07 0 0 0 4.08-4.06 4.14 4.14 0 0 0-3.97-4.1z" />
        <path d="M19.34 14.5a3.5 3.5 0 0 0-3.21-3.48c-.2 0-.39.02-.58.05a5.45 5.45 0 0 0-4.9-3.3 5.4 5.4 0 0 0-5.26 3.97 4.17 4.17 0 0 0-3.4 4.06c0 2.3 1.86 4.16 4.16 4.16h9.9c1.93 0 3.5-1.57 3.5-3.5z" />
      </svg>
    );
  }

  if (norm.includes("vercel")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-white shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M24 22.525H0l12-21.05 12 21.05z" />
      </svg>
    );
  }

  if (norm.includes("adyen")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#0ABF53] shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M15.82 12.3c0-1.84-1.32-3.08-3.08-3.08s-3.08 1.24-3.08 3.08 1.32 3.08 3.08 3.08 3.08-1.24 3.08-3.08zm4.72 0c0 4.28-3.52 7.8-7.8 7.8S4.94 16.58 4.94 12.3s3.52-7.8 7.8-7.8c2.04 0 3.92.8 5.34 2.12l-2.92 2.92c-.64-.62-1.48-.96-2.42-.96-2.02 0-3.66 1.64-3.66 3.66s1.64 3.66 3.66 3.66c1.86 0 3.38-1.38 3.62-3.18h-3.62v-3.76h7.72c.06.6.1 1.2.1 1.84z" />
      </svg>
    );
  }

  if (norm.includes("netlify")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#00C7B7] shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M17.034 8.784L12.9 4.65a.65.65 0 0 0-.918 0L7.848 8.784a.65.65 0 0 0 0 .918l4.134 4.134a.65.65 0 0 0 .918 0l4.134-4.134a.65.65 0 0 0 0-.918zM12.44 2.12l8.86 8.86a.65.65 0 0 1 0 .918l-8.86 8.86a.65.65 0 0 1-.918 0l-8.86-8.86a.65.65 0 0 1 0-.918l8.86-8.86a.65.65 0 0 1 .918 0z" />
      </svg>
    );
  }

  // Fallback geometric mark
  return (
    <div className={cn("rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center font-mono", className)}>
      {company.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function CompanyLogo({
  company,
  variant = "hero",
  accentColor,
  className,
  showName = true,
}: CompanyLogoProps) {
  const norm = company.toLowerCase();

  // Assigned spectral accent color per reference specification
  const spectralColor =
    accentColor ||
    (norm.includes("stripe")
      ? "var(--magenta)"
      : norm.includes("cloudflare")
      ? "var(--amber)"
      : norm.includes("vercel")
      ? "var(--cyan)"
      : norm.includes("adyen")
      ? "var(--violet)"
      : "#79d7ff");

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-medium text-[#F3F4F6]", className)}>
        <span className="w-3.5 h-3.5 inline-flex items-center justify-center">
          <CompanyVector company={company} className="w-3.5 h-3.5" />
        </span>
        {showName && <span>{company}</span>}
      </span>
    );
  }

  if (variant === "mini") {
    return (
      <span
        className={cn(
          "w-7 h-7 rounded-[7px] inline-grid place-items-center bg-[rgba(255,255,255,0.045)] border border-[rgba(255,255,255,0.09)] shadow-[0_8px_22px_rgba(0,0,0,0.28)] shrink-0",
          className
        )}
      >
        <CompanyVector company={company} className="w-4 h-4" />
      </span>
    );
  }

  // Hero variant: 3-column finding card logo box matching reference .company-logo
  return (
    <div
      style={{
        ["--accent" as any]: spectralColor,
      }}
      className={cn(
        "company-logo group relative min-h-[84px] px-4 rounded-[12px] flex items-center justify-center gap-3 overflow-hidden select-none",
        "bg-gradient-to-br from-white/[0.075] to-white/[0.025] border border-white/[0.12] shadow-[0_18px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.045)]",
        className
      )}
    >
      {/* Subtle bottom accent line */}
      <div
        className="absolute inset-x-[-30%] bottom-0 h-[1px] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${spectralColor}, transparent)`,
        }}
      />

      {/* Recognized company vector mark */}
      <CompanyVector company={company} className="w-7 h-7 relative z-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" />

      {/* Brand Name */}
      {showName && (
        <span className="relative z-10 font-bold tracking-tight text-[#F5F5F7] text-sm sm:text-base drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {company}
        </span>
      )}
    </div>
  );
}
