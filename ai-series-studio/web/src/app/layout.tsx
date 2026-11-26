import type { Metadata } from "next";
import Link from "next/link";
import { Figtree, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-noto-deva", weight: ["400", "500", "600"] });

export const metadata: Metadata = { title: "Microdrama Studio", description: "From a series brief to a playable episode." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${deva.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-3 w-3 rounded-full bg-accent" />
              Microdrama Studio
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
