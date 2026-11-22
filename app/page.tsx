import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedDiscoveries from "@/components/FeaturedDiscoveries";
import SolarSystemPreview from "@/components/SolarSystemPreview";
import PopularObjects from "@/components/PopularObjects";
import DiscoverySection from "@/components/DiscoverySection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeaturedDiscoveries />
        <SolarSystemPreview />
        <PopularObjects />
        <DiscoverySection />
      </main>
      <Footer />
    </>
  );
}
