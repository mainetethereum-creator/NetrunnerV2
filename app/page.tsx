import type { Metadata } from "next";
import HubApp from "@/src/ui/hub/HubApp";

export const metadata: Metadata = {
  title: "CyberBase — Hub",
  description: "Explore, fight, own. Enter the CyberBase refuge.",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return <HubApp />;
}
