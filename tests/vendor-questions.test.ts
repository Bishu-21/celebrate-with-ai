import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini", () => ({
  compareVendorQuotes: vi.fn(async () => {
    throw new Error("Gemini did not return a usable plan.");
  }),
}));

import { POST } from "@/app/api/vendors/questions/route";
import { localVendorQuestions } from "@/domain/vendors";

const body = {
  category: "catering" as const,
  mustHaves: "Vegetarian meals and step-free access.",
  guestCoverage: 40,
  budgetCapInr: 60000,
  occasion: "birthday" as const,
  city: "Pune",
};

describe("vendor questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks about inclusions, coverage, and extras without claiming a booking", () => {
    const questions = localVendorQuestions(body);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.join(" ")).toMatch(/included/i);
    expect(questions.join(" ")).toMatch(/40/);
    expect(questions.join(" ")).toMatch(/GST|overtime|transport/i);
    expect(questions.join(" ")).toMatch(/Do not treat this as a booking/);
    expect(questions.join(" ")).not.toMatch(/available on/i);
  });

  it("returns labelled local questions when Gemini does not answer", async () => {
    const request = new Request("http://localhost/api/vendors/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { source: string; questions: string[]; warning: string };
    expect(payload.source).toBe("local");
    expect(payload.questions.length).toBeGreaterThanOrEqual(3);
    expect(payload.warning).toMatch(/Gemini did not write them/);
  });
});
