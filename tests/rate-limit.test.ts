import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("allows ten calls in a minute and then says how long to wait", () => {
    const key = `rate-${Date.now()}`;
    const start = 1_700_000_000_000;
    for (let index = 0; index < 10; index += 1) {
      expect(rateLimit(key, start + index).ok).toBe(true);
    }
    const blocked = rateLimit(key, start + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(rateLimit(key, start + 60_000).ok).toBe(true);
  });
});
