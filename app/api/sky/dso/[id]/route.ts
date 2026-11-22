import { getDsoLive, isSimbadIdent } from "@/services/live/simbad";
import { rateLimit } from "@/utils/rateLimit";
import { clientIp } from "@/utils/clientIp";

/** Server-side SIMBAD proxy for deep-sky objects. The identifier is restricted to letters, digits and one space, so it cannot alter the query. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  if (!isSimbadIdent(id)) return Response.json({ error: "unknown-object" }, { status: 404 });

  const ip = clientIp(request.headers);
  const rl = rateLimit(ip);
  if (!rl.ok) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const data = await getDsoLive(id);
  return Response.json(data, {
    headers: { "Cache-Control": data.measurements.status === "ok" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=60" },
  });
}
