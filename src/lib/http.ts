import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sanitizeUnknown } from "@/lib/sanitize";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
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
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, response: apiError(415, "unsupported_type", "Request body must be JSON.", false) };
  }

  const text = await request.text();
  if (Buffer.byteLength(text) > 120_000) {
    return { ok: false, response: apiError(413, "payload_too_large", "Request is too large.", false) };
  }

  try {
    return { ok: true, data: sanitizeUnknown(JSON.parse(text) as unknown) };
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "Request body must be JSON.", false) };
  }
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
