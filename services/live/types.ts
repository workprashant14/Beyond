import type { DataSource } from "@/types/celestial";

export interface LiveRow {
  label: string;
  value: string;
  /** Short qualifier, e.g. "as of 2026-11-08 12:00 TDB". */
  note?: string;
}

export interface LiveImage {
  id: string;
  title: string;
  /** Always https://images-assets.nasa.gov/... (validated). */
  src: string;
  pageUrl: string;
  credit: string | null;
  date: string | null;
}

export type UnavailableReason = "network" | "timeout" | "http" | "parse" | "not-found" | "ambiguous" | "no-source";

export interface Unavailable {
  status: "unavailable";
  reason: UnavailableReason;
  detail?: string;
}

export interface Ok<T> {
  status: "ok";
  data: T;
  sources: DataSource[];
  fetchedAt: string;
}

export type Section<T> = Ok<T> | Unavailable;

export interface LiveResponse {
  id: string;
  images: Section<LiveImage[]>;
  measurements: Section<LiveRow[]>;
}
