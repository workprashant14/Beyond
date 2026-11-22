export default function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
      {text && <p className="mt-5 text-base leading-relaxed text-muted">{text}</p>}
    </div>
  );
}
