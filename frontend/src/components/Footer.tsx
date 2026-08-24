import React from "react";

interface FooterProps {
  companies?: string[];
}

export function Footer({ companies = ["Vercel", "Netlify", "Cloudflare Pages", "Cloudflare Workers"] }: FooterProps) {
  const trackedList = companies.length > 0
    ? companies.join(" · ")
    : "Vercel · Netlify · Cloudflare Pages · Cloudflare Workers";

  return (
    <footer className="border-t border-[#1F2023] py-8 text-center text-xs text-[#71717A] bg-[#08090C]">
      <div className="mx-auto max-w-6xl px-4">
        <p className="font-normal tracking-wide">
          Currently tracking <span className="text-[#A1A1AA]">{trackedList}</span>
        </p>
      </div>
    </footer>
  );
}
