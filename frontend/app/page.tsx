import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/layout/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import ServicesSection from "@/components/home/ServicesSection";
import PropertyJourney from "@/components/home/PropertyJourney";
import FeaturedProperties from "@/components/home/FeaturedProperties";
import IslandWideReach from "@/components/home/IslandWideReach";
import FaqSection from "@/components/home/FaqSection";
import AskAmayaBanner from "@/components/home/AskAmayaBanner";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";
import { getInventorySummary, getSiteConfiguration } from "@/lib/api";

export const revalidate = 60;

export default async function Home() {
  const [summary, config] = await Promise.all([
    getInventorySummary().catch(() => null),
    getSiteConfiguration().catch(() => null),
  ]);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <ServicesSection />
        <PropertyJourney />
        <FeaturedProperties
          initialInventoryCount={summary?.total_listings ?? null}
          initialVisibleCount={config?.featured_settings?.visible_count}
          initialCycleIntervalSeconds={config?.featured_settings?.cycle_interval_seconds}
          initialAutoCycle={config?.featured_settings?.auto_cycle}
        />
        <IslandWideReach />
        <FaqSection />
        <AskAmayaBanner />
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
