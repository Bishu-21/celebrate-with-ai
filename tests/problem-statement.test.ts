import { describe, expect, it } from "vitest";
import { buildLocalPlan } from "@/domain/local-plan";
import { sumAmounts } from "@/domain/money";
import { parseConstraintChange, revisePlan } from "@/domain/revision";
import { compareVendorQuotes } from "@/domain/vendors";
import type { VendorQuote } from "@/domain/types";
import { FIXTURE_BRIEF } from "./brief";

const SENTENCE = "We have 50 more guests, the budget dropped by ₹2,00,000, and the event is 2 weeks earlier.";

describe("problem statement", () => {
  it("revises the open plan instead of starting over", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-priya", today: "2026-11-01" });
    plan.timelineTasks = plan.timelineTasks.map((task) =>
      task.id === "lock-date-venue" ? { ...task, status: "done", overdue: false } : task,
    );
    const checklist = plan.checklist.find((item) => item.taskId === "lock-date-venue");
    if (checklist) checklist.done = true;

    expect(plan.budgetBreakdown.every((line) => line.isEstimated)).toBe(true);
    expect(plan.timelineTasks.find((task) => task.id === "book-catering")?.dependencies).toContain("lock-date-venue");

    const delta = parseConstraintChange(SENTENCE, plan.budgetInr, plan.eventDate);
    const { plan: next, changes } = revisePlan(plan, delta, "2026-11-01");

    expect(next.id).toBe(plan.id);
    expect(next.guestCount).toBe(plan.guestCount + 50);
    expect(next.budgetInr).toBe(plan.budgetInr - 200_000);
    expect(next.eventDate).toBe("2026-12-06");
    expect(next.timelineTasks.map((task) => task.id)).toEqual(plan.timelineTasks.map((task) => task.id));
    expect(next.timelineTasks.find((task) => task.id === "lock-date-venue")?.status).toBe("done");
    expect(next.checklist.find((item) => item.taskId === "lock-date-venue")?.done).toBe(true);
    expect(sumAmounts(next.budgetBreakdown)).toBeGreaterThan(next.budgetInr);
    expect(next.tradeOffScenarios.length).toBeGreaterThan(0);
    expect(changes.join(" ")).toMatch(/Guest count/);
    expect(changes.join(" ")).toMatch(/No cut was applied/);
  });

  it("compares host quotations without inventing availability", () => {
    const quotes: VendorQuote[] = [
      {
        id: "amber",
        vendorName: "Amber Kitchen",
        category: "catering",
        amountInr: 48000,
        guestCoverage: 40,
        included: ["Food"],
        notes: "GST extra.",
        isEstimated: false,
      },
      {
        id: "tiffins",
        vendorName: "Pune Tiffins",
        category: "catering",
        amountInr: 61000,
        guestCoverage: 30,
        included: ["Food", "Cake"],
        notes: "Overtime after 10pm.",
        isEstimated: false,
      },
    ];
    const rows = compareVendorQuotes(quotes, 40, { catering: 60000 });
    expect(rows[0]).toMatchObject({ coversHeadcount: true, withinCap: true });
    expect(rows[1]).toMatchObject({ coversHeadcount: false, withinCap: false });
    expect(rows[0]?.hiddenChargeNotes.join(" ")).toMatch(/GST/);
    expect(rows[1]?.hiddenChargeNotes.join(" ")).toMatch(/Overtime/);
    expect(JSON.stringify(rows)).not.toMatch(/availab/i);
  });
});
