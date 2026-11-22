/**
 * Client address for rate limiting.
 *
 * `X-Forwarded-For` is a list: each proxy appends the address it received the request from. Everything to the LEFT of
 * the entries added by proxies you trust can be written by the caller, so taking the first entry (the old behaviour) lets
 * anyone dodge the limiter by sending their own header. We count `trustedHops` entries from the RIGHT instead.
 *
 * trustedHops = number of proxies in front of the app that append to the header. Default 1 (Vercel, or one reverse proxy).
 * Set TRUSTED_PROXY_HOPS=2 behind e.g. a CDN plus a load balancer, and 0 to ignore the header entirely (local dev).
 */
export function clientIp(headers: Pick<Headers, "get">, trustedHops = hopsFromEnv()): string {
  if (trustedHops <= 0) return "unknown";
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const pick = parts[parts.length - trustedHops];
  // Keep only characters valid in an IPv4/IPv6 address so the value is safe as a map key and a log field.
  return pick && /^[0-9a-fA-F:.]{2,45}$/.test(pick) ? pick : "unknown";
}

function hopsFromEnv(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? "1");
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}
