import { describe, expect, it } from "vitest";
import { allocateBudget, proposeTradeoffs, protectsTopPriority, scaleCateringForGuests } from "@/domain/budget";
import { sumAmounts } from "@/domain/money";
import type { BudgetLine, Category } from "@/domain/types";

const priorities: Category[] = ["catering", "venue", "photography", "decor", "entertainment", "miscellaneous"];

describe("budget", () => {
  it("allocates the full budget and marks every line as an estimate", () => {
    const lines = allocateBudget(1_500_000, "grand", priorities);
    expect(sumAmounts(lines)).toBe(1_500_000);
    expect(lines.every((line) => line.isEstimated)).toBe(true);
    expect(lines.map((line) => line.category)).toEqual([
      "venue",
      "catering",
      "decor",
      "photography",
      "entertainment",
      "miscellaneous",
    ]);
  });

  it("scales catering with the guest count and leaves other lines alone", () => {
    const lines = allocateBudget(100_000, "intimate", priorities);
    const scaled = scaleCateringForGuests(lines, 100, 150);
    const before = lines.find((line) => line.category === "catering")?.amountInr ?? 0;
    const after = scaled.find((line) => line.category === "catering")?.amountInr ?? 0;
    expect(after).toBe(Math.round(before * 1.5));
    expect(scaled.find((line) => line.category === "venue")?.amountInr).toBe(lines.find((line) => line.category === "venue")?.amountInr);
  });

  it("protects food when the plan is about 20 percent over budget", () => {
    const budgetInr = 500_000;
    const lines = allocateBudget(budgetInr, "intimate", priorities).map((line) => ({
      ...line,
      amountInr: Math.round(line.amountInr * 1.2),
    }));
    const scenarios = proposeTradeoffs(lines, budgetInr, priorities);
    expect(sumAmounts(lines)).toBeGreaterThan(budgetInr);
    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      expect(sumAmounts(scenario.lines)).toBe(budgetInr);
      expect(protectsTopPriority(lines, scenario.lines, "catering")).toBe(true);
      expect(scenario.lines.every((line) => line.isEstimated)).toBe(true);
    }
  });

  it("protects the top priority when closing an overage", () => {
    const lines: BudgetLine[] = [
      { category: "venue", amountInr: 30_000, assumption: "Estimate.", isEstimated: true },
      { category: "catering", amountInr: 80_000, assumption: "Estimate.", isEstimated: true },
      { category: "decor", amountInr: 20_000, assumption: "Estimate.", isEstimated: true },
      { category: "photography", amountInr: 15_000, assumption: "Estimate.", isEstimated: true },
      { category: "entertainment", amountInr: 25_000, assumption: "Estimate.", isEstimated: true },
      { category: "miscellaneous", amountInr: 10_000, assumption: "Estimate.", isEstimated: true },
    ];
    const scenarios = proposeTradeoffs(lines, 100_000, priorities);
    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      expect(sumAmounts(scenario.lines)).toBe(100_000);
      expect(protectsTopPriority(lines, scenario.lines, "catering")).toBe(true);
    }
  });
});
