const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_KEYS = 1_000;

type Bucket = { stamps: number[]; head: number };

const hits = new Map<string, Bucket>();
let callsSincePrune = 0;

function liveCount(bucket: Bucket, now: number): number {
  const cutoff = now - WINDOW_MS;
  let head = bucket.head;
  while (head < bucket.stamps.length && bucket.stamps[head] <= cutoff) head += 1;
  bucket.head = head;
  if (head > 24 && head * 2 > bucket.stamps.length) {
    bucket.stamps = bucket.stamps.slice(head);
    bucket.head = 0;
  }
  return bucket.stamps.length - bucket.head;
}

function prune(now: number): void {
  callsSincePrune += 1;
  if (callsSincePrune < 32 && hits.size <= MAX_KEYS) return;
  callsSincePrune = 0;
  for (const [key, bucket] of hits) {
    if (liveCount(bucket, now) === 0) hits.delete(key);
  }
  while (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
}

export function rateLimit(key: string, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  prune(now);
  let bucket = hits.get(key);
  if (!bucket) {
    bucket = { stamps: [], head: 0 };
    hits.set(key, bucket);
  }
  const count = liveCount(bucket, now);
  if (count >= MAX_REQUESTS) {
    const oldest = bucket.stamps[bucket.head] ?? now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)) };
  }
  bucket.stamps.push(now);
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(request: Request): string {
  const trustPlatform = process.env.TRUST_FORWARDED_FOR === "1" || process.env.VERCEL === "1";
  if (!trustPlatform) return "local";
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp || forwarded;
  return ip ? ip.slice(0, 80) : "local";
}
