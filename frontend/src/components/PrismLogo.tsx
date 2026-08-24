import React from "react";
import Link from "next/link";

interface PrismLogoProps {
  className?: string;
  size?: number;
}

export function PrismLogo({ className = "", size = 22 }: PrismLogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 group transition-opacity hover:opacity-90 ${className}`}
    >
      {/* Precision Prism Triangle Mark matching Vercel/Prism aesthetic */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <polygon
          points="12,3 22,21 2,21"
          fill="#FFFFFF"
        />
      </svg>

      <span className="font-semibold text-lg tracking-tight text-white font-sans">
        Prism<span className="text-blue-400">IQ</span>
      </span>
    </Link>
  );
}
