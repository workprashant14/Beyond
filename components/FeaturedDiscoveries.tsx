import { getFeatured } from "@/services/catalogue";
import ObjectCard from "./ObjectCard";
import SectionHeading from "./SectionHeading";

export default function FeaturedDiscoveries() {
  const items = getFeatured();
  return (
    <section id="featured" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
      <SectionHeading
        eyebrow="Featured discoveries"
        title="Places worth a long look"
        text="From the heart of our own galaxy to the nearest known exoplanet. Values shown come from the catalogue and read “Data unavailable” when we have no verified figure."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((o) => (
          <ObjectCard key={o.id} obj={o} />
        ))}
      </div>
    </section>
  );
}
