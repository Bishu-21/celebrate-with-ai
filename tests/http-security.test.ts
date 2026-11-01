import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readBody, readJson } from "@/lib/http";
import { clientKey } from "@/lib/rate-limit";

function post(headers: Record<string, string>, body: string) {
  return readBody(new Request("http://localhost/api/plan/generate", { method: "POST", headers, body }));
}

describe("request security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a different origin", async () => {
    const result = await post({ origin: "https://evil.example", "content-type": "application/json" }, "{}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toMatchObject({ code: "cross_origin" });
  });

  it("compares the complete origin including protocol", async () => {
    const result = await post({ origin: "https://localhost", "content-type": "application/json" }, "{}");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("accepts the actual HTTP host when Next internally uses a loopback URL", async () => {
    const result = await post({ origin: "http://127.0.0.1", host: "127.0.0.1", "content-type": "application/json" }, "{}");
    expect(result.ok).toBe(true);
  });

  it("rejects a lookalike JSON media type", async () => {
    const result = await post({ "content-type": "text/application/json-invalid" }, "{}");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(415);
  });

  it("stops reading an oversized stream before buffering the entire request", async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(65_000).fill(32));
        if (pulls >= 10) controller.close();
      }, cancel,
    });
    const request = new Request("http://localhost/api/plan/generate", {
      method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half",
    } as RequestInit);
    const result = await readBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
    expect(pulls).toBeLessThan(10);
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const result = await post({ origin: "http://localhost", "content-type": "text/plain" }, "hello");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(415);
  });

  it("strips control characters and dangerous keys from same-origin JSON", async () => {
    const result = await post(
      { origin: "http://localhost", "content-type": "application/json" },
      '{"note":"a\\u0000b\\u202Ec","__proto__":{"admin":true},"nested":{"constructor":{"prototype":{"polluted":true}}}}',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ note: "abc", nested: {} });
    expect(Object.prototype).not.toHaveProperty("admin");
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("keys the limit by the platform IP and ignores spoofed forwarding elsewhere", () => {
    const request = new Request("http://localhost/api/plan/generate", {
      headers: { "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.4" },
    });
    expect(clientKey(request)).toBe("local");
    vi.stubEnv("VERCEL", "1");
    expect(clientKey(request)).toBe("203.0.113.10");
  });

  it("returns parsed JSON when the body matches the schema", async () => {
    const request = new Request("http://localhost/api/plan/ideas", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ plan: { title: "Holi" } }),
    });
    const result = await readJson(request, z.object({ plan: z.object({ title: z.string() }) }), "Ideas need a valid plan.");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.plan.title).toBe("Holi");
  });

  it("returns the caller message when JSON fails the schema", async () => {
    const request = new Request("http://localhost/api/plan/ideas", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const result = await readJson(request, z.object({ plan: z.object({ title: z.string() }) }), "Ideas need a valid plan.");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({ error: "Ideas need a valid plan." });
  });
});
