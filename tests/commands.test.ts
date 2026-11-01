import { describe, expect, it } from "vitest";
import { applyPlanCommand } from "@/domain/commands";
import { buildLocalPlan } from "@/domain/local-plan";
import { checklistFromDraft } from "@/domain/merge-draft";
import { mergeQuotes } from "@/domain/vendors";
import { overageInr } from "@/domain/budget";
import { FIXTURE_BRIEF } from "./brief";

describe("plan commands", () => {
  it("confirms a quote without lowering it to fit the budget", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-command", today: "2026-11-01" });
    const result = applyPlanCommand(plan, {
      type: "confirm-quote",
      category: "venue",
      amountInr: plan.budgetInr + 50_000,
      vendorName: "Amber Hall",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const venue = result.plan.budgetBreakdown.find((line) => line.category === "venue");
    expect(venue?.amountInr).toBe(plan.budgetInr + 50_000);
    expect(venue?.isEstimated).toBe(false);
    expect(overageInr(result.plan.budgetBreakdown, result.plan.budgetInr)).toBeGreaterThan(0);
    expect(result.warning).toMatch(/over the budget/i);
  });

  it("marks the linked checklist item when a task is done", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-command", today: "2026-11-01" });
    const result = applyPlanCommand(plan, { type: "set-task-status", taskId: "lock-date-venue", status: "done", today: "2026-11-01" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.checklist.filter((item) => item.taskId === "lock-date-venue").every((item) => item.done)).toBe(true);
  });

  it("scales catering from RSVP attendance without replacing the planning guest count", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-command", today: "2026-11-01" });
    const before = plan.budgetBreakdown.find((line) => line.category === "catering")?.amountInr ?? 0;
    const once = applyPlanCommand(plan, { type: "apply-headcount", guestCount: 3, today: "2026-11-01" });
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(once.plan.guestCount).toBe(plan.guestCount);
    const scaled = once.plan.budgetBreakdown.find((line) => line.category === "catering")?.amountInr ?? 0;
    expect(scaled).toBeLessThan(before);
    const twice = applyPlanCommand(once.plan, { type: "apply-headcount", guestCount: 3, today: "2026-11-01" });
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.plan.budgetBreakdown.find((line) => line.category === "catering")?.amountInr).toBe(scaled);
    expect(twice.plan.vendorBriefs.find((brief) => brief.category === "venue")?.guestCoverage).toBe(plan.guestCount);
  });

  it("links a checklist item only when the title matches a task", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-command", today: "2026-11-01" });
    const items = checklistFromDraft(["Order flowers", plan.timelineTasks[0]?.title ?? ""], plan.timelineTasks);
    expect(items[0]?.taskId).toBeNull();
    expect(items[1]?.taskId).toBe(plan.timelineTasks[0]?.id);
  });

  it("keeps quotes from other categories when one category is compared", () => {
    const venue = { id: "venue-1", vendorName: "Hall", category: "venue" as const, amountInr: 1000, guestCoverage: 10, included: [], notes: "", isEstimated: false };
    const food = { id: "food-1", vendorName: "Kitchen", category: "catering" as const, amountInr: 2000, guestCoverage: 10, included: [], notes: "", isEstimated: false };
    const replacement = { ...food, id: "food-2", vendorName: "Other kitchen" };
    expect(mergeQuotes([venue, food], [replacement]).map((quote) => quote.id)).toEqual(["venue-1", "food-2"]);
  });

  it("rejects a party size of zero", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-command", today: "2026-11-01" });
    const result = applyPlanCommand(plan, {
      type: "upsert-guest",
      guest: { id: "g1", name: "Asha", email: "", partySize: 0, status: "yes", mealNote: "" },
    });
    expect(result.ok).toBe(false);
  });
});
