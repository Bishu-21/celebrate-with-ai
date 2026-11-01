import { describe, expect, it } from "vitest";
import { vendorCompareRequestSchema } from "@/lib/schemas";

const quote = {
  id: "quote-1",
  vendorName: "Anokhi Kitchen",
  category: "catering" as const,
  amountInr: 48000,
  guestCoverage: 40,
  included: ["Vegetarian dinner"],
  notes: "GST extra",
  isEstimated: false,
};

describe("vendor compare contract", () => {
  it("requires city, occasion, and must-haves", () => {
    const parsed = vendorCompareRequestSchema.safeParse({
      quotes: [quote, { ...quote, id: "quote-2", vendorName: "Second Kitchen" }],
      headcount: 40,
      capInr: 50000,
      category: "catering",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a quotation from another category", () => {
    const parsed = vendorCompareRequestSchema.safeParse({
      quotes: [quote, { ...quote, id: "quote-2", vendorName: "Hall Co", category: "venue" }],
      headcount: 40,
      capInr: 50000,
      category: "catering",
      mustHaves: "Vegetarian menu",
      occasion: "birthday",
      city: "Pune",
    });
    expect(parsed.success).toBe(false);
  });
});
