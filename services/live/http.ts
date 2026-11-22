import type { UnavailableReason } from "./types";

/** Anything that goes wrong talking to an upstream API. Mapped to an `unavailable` section, never thrown to the UI. */
export class LiveError extends Error {
  constructor(
    public reason: UnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = "LiveError";
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  /** Next.js data-cache lifetime in seconds. */
  revalidate?: number;
  /** HTTP statuses that carry a meaningful JSON body (e.g. SBDB answers 300 for "ambiguous"). */
  acceptStatuses?: number[];
}

const MAX_BYTES = 2_000_000;

/** GET JSON with a hard timeout, size cap and normalised errors. Server-side only. */
export async function fetchJson(url: string, opts: FetchOptions = {}): Promise<{ status: number; json: unknown }> {
  const { timeoutMs = 8000, revalidate = 3600, acceptStatuses = [] } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "BEYOND-universe-explorer/0.1 (educational project)" },
      next: { revalidate },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new LiveError(aborted ? "timeout" : "network", aborted ? "request timed out" : "network error");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok && !acceptStatuses.includes(res.status)) {
    throw new LiveError(res.status === 404 ? "not-found" : "http", `HTTP ${res.status}`);
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new LiveError("parse", "response too large");
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    throw new LiveError("parse", "response was not valid JSON");
  }
}
