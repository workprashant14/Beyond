/**
 * Every datum shown in BEYOND belongs to exactly one of these classes.
 * The UI renders a badge so a reader can always tell "measured" from "drawn".
 */
export type DataKind = "observed" | "estimated" | "artistic" | "theoretical";

export const DATA_KIND: Record<DataKind, { label: string; blurb: string }> = {
  observed: { label: "Observed", blurb: "Catalogued measurement or identifier from an astronomical survey." },
  estimated: { label: "Estimated", blurb: "Calculated from observed data with a stated method; carries uncertainty." },
  artistic: { label: "Artistic / conventional", blurb: "Drawn or conventional, not a physical structure (constellation figures, scene layout, colours)." },
  theoretical: { label: "Theoretical", blurb: "Hypothesised or model-based; not directly observed." },
};
