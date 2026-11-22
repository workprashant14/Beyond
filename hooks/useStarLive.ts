import { useLiveJson } from "./useLiveJson";
import type { LiveRow, Section } from "@/services/live/types";

export interface SimbadLive { measurements: Section<LiveRow[]> }

export const useStarLive = (hip: number) => useLiveJson<SimbadLive>(`/api/sky/star/${hip}`);
export const useDsoLive = (id: string) => useLiveJson<SimbadLive>(`/api/sky/dso/${encodeURIComponent(id)}`);
