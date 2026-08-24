"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PrismLogo } from "./PrismLogo";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Live Brief", href: "/brief" },
    { name: "How it works", href: "/how-it-works" },
    { name: "Archive", href: "/archive" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#1F2023] bg-[#08090C]/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Navigation Links */}
          <div className="flex items-center gap-8">
            <PrismLogo />

            <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href === "/brief" && pathname?.startsWith("/brief"));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`transition-colors duration-150 ${
                      isActive
                        ? "text-white font-semibold"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/brief"
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs sm:text-sm font-medium text-black transition-all duration-150 hover:bg-[#E5E5E5] active:scale-98 shadow-xs"
            >
              View Latest Brief
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
