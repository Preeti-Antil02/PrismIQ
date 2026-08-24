import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "PrismIQ — Reveal the Intelligence",
  description:
    "PrismIQ turns scattered news and GitHub signals from your competitors into one weekly brief — sourced, tiered by what actually matters, and ready in one command.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased bg-[#08090C] text-[#EDEDED]">
      <body className="min-h-full flex flex-col bg-[#08090C] text-[#EDEDED] selection:bg-blue-600/30 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
