const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_KEYS = 1_000;
const hits = new Map<string, number[]>();

function prune(now: number): void {
  for (const [key, stamps] of hits) {
    const recent = stamps.filter((stamp) => now - stamp < WINDOW_MS);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
  while (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (!oldest) break;
    hits.delete(oldest);
  }
}

export function rateLimit(key: string, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  prune(now);
  const recent = hits.get(key) ?? [];
  if (recent.length >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return { ok: false, retryAfterSeconds };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(request: Request): string {
  if (process.env.TRUST_FORWARDED_FOR === "1") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 80);
  }
  return "local";
}
