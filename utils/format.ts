export const UNAVAILABLE = "Data unavailable";

/** Never invent values: null/empty becomes an honest placeholder. */
export const orUnavailable = (v: string | null | undefined): string => (v && v.trim() ? v : UNAVAILABLE);
