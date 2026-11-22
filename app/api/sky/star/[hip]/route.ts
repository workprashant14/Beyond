import { getStarLive } from "@/services/live/simbad";
import { rateLimit } from "@/utils/rateLimit";
import { clientIp } from "@/utils/clientIp";

/** Server-side proxy for SIMBAD star lookups (spectral type, parallax). The browser never talks to SIMBAD directly. */
export async function GET(request: Request, { params }: { params: Promise<{ hip: string }> }) {
  const { hip: raw } = await params;
  const hip = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(hip) || hip < 1 || hip > 120000) return Response.json({ error: "unknown-star" }, { status: 404 });

  const ip = clientIp(request.headers);
  const rl = rateLimit(ip);
  if (!rl.ok) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const data = await getStarLive(hip);
  return Response.json(data, {
    headers: { "Cache-Control": data.measurements.status === "ok" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=60" },
  });
}
