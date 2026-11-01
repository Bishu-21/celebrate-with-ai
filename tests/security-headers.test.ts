import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("locks framing and objects, and adds HSTS only in production", () => {
    const dev = securityHeaders(true).map((header) => header.key);
    const prod = Object.fromEntries(securityHeaders(false).map((header) => [header.key, header.value]));
    expect(dev).not.toContain("Strict-Transport-Security");
    expect(prod["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(prod["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(prod["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(prod["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
});
