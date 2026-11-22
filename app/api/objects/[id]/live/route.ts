import { getObject } from "@/services/catalogue";
import { getLiveData } from "@/services/live";
import { rateLimit } from "@/utils/rateLimit";
import { clientIp } from "@/utils/clientIp";

/**
 * Server-side proxy for live NASA/JPL data. Keys (if ever needed) stay on the
 * server; the browser only ever sees this route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(id) || !getObject(id)) {
    return Response.json({ error: "unknown-object" }, { status: 404 });
  }

  const ip = clientIp(request.headers);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  const data = await getLiveData(id);
  // Don't let a CDN pin a transient upstream failure for half an hour: cache good answers long, failures only briefly.
  const healthy =
    data.images.status === "ok" && (data.measurements.status === "ok" || data.measurements.reason === "no-source");
  return Response.json(data, {
    headers: {
      "Cache-Control": healthy ? "public, s-maxage=1800, stale-while-revalidate=86400" : "public, s-maxage=60",
    },
  });
}
