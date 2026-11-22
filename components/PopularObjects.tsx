import { getPopular } from "@/services/catalogue";
import ObjectCard from "./ObjectCard";
import SectionHeading from "./SectionHeading";

export default function PopularObjects() {
  const items = getPopular();
  return (
    <section id="popular" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
      <SectionHeading eyebrow="Popular objects" title="What explorers open first" />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((o) => (
          <ObjectCard key={o.id} obj={o} compact />
        ))}
      </div>
    </section>
  );
}
