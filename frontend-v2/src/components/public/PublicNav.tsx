"use client";

import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="ps-nav">
      <Link className="ps-brand" href="#top">
        <svg className="ps-brandLogo" viewBox="0 0 42 42" aria-label="PrismIQ logo">
          <defs>
            <linearGradient id="navA" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#5A72FF" />
              <stop offset=".52" stopColor="#8B4DFF" />
              <stop offset="1" stopColor="#FF83C8" />
            </linearGradient>
            <linearGradient id="navB" x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#62DDF2" />
              <stop offset=".55" stopColor="#7264FF" />
              <stop offset="1" stopColor="#FFB18F" />
            </linearGradient>
          </defs>
          <path d="M21 3 37 31 21 39 5 31Z" fill="url(#navA)" opacity=".92" />
          <path d="M21 3 21 39 5 31Z" fill="url(#navB)" opacity=".88" />
          <path d="M21 3 37 31 21 26Z" fill="#9D8CFF" opacity=".72" />
          <path d="M21 26 37 31 21 39Z" fill="#FF72C2" opacity=".58" />
          <path d="M21 8 21 26 13 29Z" fill="#FFFFFF" opacity=".42" />
        </svg>
        <span>PrismIQ</span>
      </Link>
      <div className="ps-links">
        <a href="#why">Why PrismIQ</a>
        <a href="#how">How it works</a>
        <a href="#product">Product</a>
        <a href="#research">Research</a>
      </div>
      <div className="ps-actions">
        <a className="ps-btn ps-btn-light" href="#product">
          See product
        </a>
        <Link className="ps-btn ps-btn-dark" href="/signup">
          Get started
        </Link>
      </div>
    </nav>
  );
}
