import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sanitizeUnknown } from "@/lib/sanitize";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = new URL(request.url);
    // Next's standalone server can use localhost internally even when the browser used 127.0.0.1.
    const host = request.headers.get("host");
    if (host) expected.host = host;
    return new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}

export async function readBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > 120_000) {
    return { ok: false, response: apiError(413, "payload_too_large", "Request is too large.", false) };
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.ok) {
    return {
      ok: false,
      response: apiError(429, "rate_limited", "Too many planning requests. Wait a moment and try again.", true, {
        "Retry-After": String(limit.retryAfterSeconds),
      }),
    };
  }

  if (!sameOrigin(request)) return { ok: false, response: apiError(403, "cross_origin", "This planner only accepts requests from its own site.", false) };
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, response: apiError(415, "unsupported_type", "Request body must be JSON.", false) };
  }

  const reader = request.body?.getReader();
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 120_000) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, response: apiError(413, "payload_too_large", "Request is too large.", false) };
        }
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode();
    return { ok: true, data: sanitizeUnknown(JSON.parse(text) as unknown) };
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "Request body must be JSON.", false) };
  } finally {
    reader?.releaseLock();
  }
}

/** Reads a JSON body and validates it. Callers return `response` when `ok` is false. */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  message: string,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const body = await readBody(request);
  if (!body.ok) return body;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return { ok: false, response: invalid(message) };
  return { ok: true, data: parsed.data };
}

export function apiError(status: number, code: string, message: string, retryable: boolean, headers?: Record<string, string>): NextResponse {
  return NextResponse.json({ code, message, retryable, error: message }, { status, headers });
}

export function invalid(message: string): NextResponse {
  return apiError(400, "invalid_request", message, false);
}

export function geminiFailure(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Gemini did not return a usable plan.";
  const retryable = /rate|timed out|429/i.test(message);
  return apiError(502, "gemini_failed", message, retryable);
}
