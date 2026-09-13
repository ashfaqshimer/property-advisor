import ChatPanel from "@/components/chat/ChatPanel";
import Container from "@/components/layout/Container";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/layout/Hero";
import Navbar from "@/components/layout/Navbar";
import PropertyGrid from "@/components/properties/PropertyGrid";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />

      <main className="flex-1">
        <Container className="py-12 sm:py-16">
          {/*
            Two columns from `lg` up; tablet stays single-column because the
            chat panel needs real width to be usable. `items-start` keeps each
            column at its content height — without it the chat column stretches
            to match the grid and `sticky` has nothing to slide against.
          */}
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-5 lg:gap-10">
            <div className="lg:col-span-3">
              <PropertyGrid />
            </div>
            <div className="lg:col-span-2">
              <ChatPanel />
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
