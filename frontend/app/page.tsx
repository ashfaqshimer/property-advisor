import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/layout/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import PropertyJourney from "@/components/home/PropertyJourney";
import FeaturedProperties from "@/components/home/FeaturedProperties";
import IslandWideReach from "@/components/home/IslandWideReach";
import AskAmayaBanner from "@/components/home/AskAmayaBanner";
import Footer from "@/components/layout/Footer";
import ChatDialog from "@/components/chat/ChatDialog";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <PropertyJourney />
        <FeaturedProperties />
        <IslandWideReach />
        <AskAmayaBanner />
      </main>
      <Footer />
      <ChatDialog />
    </>
  );
}
