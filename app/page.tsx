import type { Metadata } from "next";
import BaseApp from "@/components/base/BaseApp";

export const metadata: Metadata = {
  title: "CyberBase — Runner's Refuge",
  description: "A home above the lower lines. Explore the CyberBase starter refuge.",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return <BaseApp />;
}
