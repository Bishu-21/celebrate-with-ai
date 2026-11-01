import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/client-api";

describe("errorText", () => {
  it("keeps an Error message and replaces anything else", () => {
    expect(errorText(new Error("Gemini is rate limiting requests. Wait and try again."), "fallback")).toBe(
      "Gemini is rate limiting requests. Wait and try again.",
    );
    expect(errorText("nope", "Could not generate a plan.")).toBe("Could not generate a plan.");
  });
});
