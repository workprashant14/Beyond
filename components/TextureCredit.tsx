"use client";

import { usePhoto } from "@/universe/objects/photoTextures";

/**
 * Credit and honest description for a NASA surface image. Shown only when that body's image has actually loaded (status "loaded");
 * while loading, or when the image is missing or failed, nothing is shown because the body is then drawn with the procedural,
 * artistic texture and must not be credited as a NASA photograph.
 */
export default function TextureCredit({ id }: { id: string }) {
  const { status, meta } = usePhoto(id);
  if (status !== "loaded" || !meta) return null;
  return (
    <p className="mt-3 rounded-lg border border-line px-3 py-2 text-xs leading-relaxed text-muted">
      Surface image: {meta.title}. Credit: {meta.credit}.{" "}
      {meta.nature} Its orientation on the sphere is not calibrated.{" "}
      {/^https:\/\//.test(meta.page) && (
        <a className="underline underline-offset-4 hover:text-ink" target="_blank" rel="noreferrer" href={meta.page}>Source page</a>
      )}
    </p>
  );
}
