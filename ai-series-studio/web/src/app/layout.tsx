import type { Metadata } from "next";
import Link from "next/link";
import { Figtree, Barlow_Condensed, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-studio-display" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-noto-deva", weight: ["400", "500", "600"] });

export const metadata: Metadata = { title: "Microdrama Studio", description: "From a series brief to a playable episode." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${deva.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="studio-header">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="studio-brand-mark" aria-hidden="true" />
              Microdrama Studio
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
