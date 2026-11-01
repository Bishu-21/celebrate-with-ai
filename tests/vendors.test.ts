import { describe, expect, it } from "vitest";
import { compareVendorQuotes } from "@/domain/vendors";
import type { VendorQuote } from "@/domain/types";

const quotes: VendorQuote[] = [
  {
    id: "q1",
    vendorName: "Saffron Table",
    category: "catering",
    amountInr: 180000,
    guestCoverage: 100,
    included: ["Dinner", "Service"],
    notes: "GST extra. Transport is additional.",
    isEstimated: false,
  },
  {
    id: "q2",
    vendorName: "City Kitchen",
    category: "catering",
    amountInr: 240000,
    guestCoverage: 180,
    included: ["Dinner", "Service", "Taxes"],
    notes: "Headline price includes service.",
    isEstimated: false,
  },
];

describe("vendors", () => {
  it("flags guest-coverage gaps and extra charges written in the notes", () => {
    const rows = compareVendorQuotes(quotes, 150, { catering: 200000 });
    expect(rows[0]?.coversHeadcount).toBe(false);
    expect(rows[0]?.withinCap).toBe(true);
    expect(rows[0]?.hiddenChargeNotes.join(" ")).toMatch(/GST/i);
    expect(rows[1]?.coversHeadcount).toBe(true);
    expect(rows[1]?.withinCap).toBe(false);
    expect(rows[1]?.isEstimated).toBe(false);
    expect(rows.every((row) => !("available" in row) && !("availability" in row))).toBe(true);
  });
});
