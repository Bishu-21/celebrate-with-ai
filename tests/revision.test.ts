import { describe, expect, it } from "vitest";
import { sumAmounts } from "@/domain/money";
import { buildLocalPlan } from "@/domain/local-plan";
import { FIXTURE_BRIEF } from "./brief";
import { parseConstraintChange, revisePlan } from "@/domain/revision";
import { protectsTopPriority } from "@/domain/budget";

describe("revision", () => {
  it("parses the fifty-guest constraint change", () => {
    const delta = parseConstraintChange(
      "We have 50 more guests, the budget dropped by ₹2,00,000, and the event is 2 weeks earlier.",
      1_500_000,
    );
    expect(delta).toEqual({ guestDelta: 50, budgetDeltaInr: -200_000, dayShift: -14 });
  });

  it("keeps the plan id and finished tasks while guests, budget, and date change", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-priya", today: "2026-11-01" });
    plan.timelineTasks = plan.timelineTasks.map((task) =>
      task.id === "lock-date-venue" ? { ...task, status: "done", overdue: false } : task,
    );
    const beforeLines = plan.budgetBreakdown.map((line) => ({ ...line }));
    const delta = parseConstraintChange(
      "We have 50 more guests, the budget dropped by ₹2,00,000, and the event is 2 weeks earlier.",
      plan.budgetInr,
    );
    const { plan: next } = revisePlan(plan, delta, "2026-11-01");

    expect(next.id).toBe("plan-priya");
    expect(next.guestCount).toBe(170);
    expect(next.budgetInr).toBe(1_300_000);
    expect(next.eventDate).toBe("2026-12-06");
    expect(sumAmounts(next.budgetBreakdown)).toBeGreaterThan(1_300_000);
    expect(next.tradeOffScenarios.length).toBeGreaterThan(0);
    expect(next.tradeOffScenarios.some((scenario) => sumAmounts(scenario.lines) === sumAmounts(next.budgetBreakdown))).toBe(false);
    expect(next.timelineTasks.find((task) => task.id === "lock-date-venue")?.status).toBe("done");
    expect(next.timelineTasks.map((task) => task.id)).toEqual(plan.timelineTasks.map((task) => task.id));
    expect(protectsTopPriority(beforeLines, next.budgetBreakdown, "catering")).toBe(true);
  });

  it("reads everyday revision sentences", () => {
    expect(parseConstraintChange("We're inviting 30 more people", 500_000).guestDelta).toBe(30);
    expect(parseConstraintChange("Budget increased to 10 lakhs", 1_500_000).absoluteBudgetInr).toBe(1_000_000);
    expect(parseConstraintChange("Move the party to November", 100_000, "2026-12-20").absoluteEventDate).toBe("2026-11-20");
  });

  it("parses an added guest count, a lakh budget, and refuses a contradiction", () => {
    expect(parseConstraintChange("Please add 50 guests", 500_000)).toMatchObject({ guestDelta: 50 });
    expect(parseConstraintChange("The budget is now 10 lakh", 1_500_000).absoluteBudgetInr).toBe(1_000_000);
    expect(parseConstraintChange("The budget dropped by ₹2,00,000 and the budget is now 10 lakh", 1_500_000).ambiguous).toMatch(/ambiguous/i);
  });

  it("keeps a confirmed catering quote when the guest count changes", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-priya", today: "2026-11-01" });
    const confirmed = 400_000;
    plan.budgetBreakdown = plan.budgetBreakdown.map((line) =>
      line.category === "catering" ? { ...line, amountInr: confirmed, isEstimated: false, origin: "quote" as const } : line,
    );
    const { plan: next } = revisePlan(plan, { guestDelta: 50, budgetDeltaInr: 0, dayShift: 0 }, "2026-11-01");
    expect(next.budgetBreakdown.find((line) => line.category === "catering")?.amountInr).toBe(confirmed);
  });
});
