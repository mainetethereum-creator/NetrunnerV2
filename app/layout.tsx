import type { Metadata } from "next";
import localFont from "next/font/local";
import Web3Provider from "@/components/providers/Web3Provider";
import "./globals.css";

const displayFont = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../assets/fonts/Martius/Martius-Regular.otf", weight: "400", style: "normal" },
    { path: "../assets/fonts/Martius/Martius-Italic.otf", weight: "400", style: "italic" },
  ],
});

export const metadata: Metadata = { title: "Netrunner — CyberBase", description: "A standalone Three.js prototype of the Netrunner refuge.", robots: { index: false, follow: false } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${displayFont.variable} h-full`} style={{ colorScheme: "dark" }}><body><Web3Provider>{children}</Web3Provider></body></html>;
}
