import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PrismIQ — Competitive Intelligence & Research Workspace",
  description: "Decision-ready competitive intelligence and field research monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#08090C] text-[#F3F4F6] selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
