import { describe, expect, it } from "vitest";
import { allocateBudget, proposeTradeoffs } from "@/domain/budget";
import { applyPlanCommand } from "@/domain/commands";
import { buildLocalPlan } from "@/domain/local-plan";
import { applyTradeoffDraft, planFromDraft } from "@/domain/merge-draft";
import { eventPlanSchema } from "@/lib/schemas";
import { revisePlan } from "@/domain/revision";
import { parseInrAmount } from "@/domain/money";
import { FIXTURE_BRIEF } from "./brief";

describe("final submission correctness regressions", () => {
  it("parses whole-rupee quotes without turning negatives or decimals into different prices", () => {
    expect(parseInrAmount("₹2,00,000")).toBe(200000);
    expect(parseInrAmount("INR 200,000")).toBe(200000);
    for (const input of ["-500", "10.50", "free", "", "9,9", "100000000000000000000"]) expect(Number.isNaN(parseInrAmount(input))).toBe(true);
  });
  it("never cuts or relabels a confirmed cost while proposing trade-offs", () => {
    const lines = allocateBudget(200_000, "grand", FIXTURE_BRIEF.priorities);
    lines[0] = { ...lines[0], amountInr: 80_000, isEstimated: false };
    const scenarios = proposeTradeoffs(lines, 180_000, FIXTURE_BRIEF.priorities);
    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) expect(scenario.lines[0]).toEqual(lines[0]);
  });

  it("rejects model scenarios that claim to protect a different priority", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const lines = plan.budgetBreakdown.map((line) => ({ ...line }));
    const food = lines.find((line) => line.category === "catering")!;
    const decor = lines.find((line) => line.category === "decor")!;
    food.amountInr -= 50_000;
    decor.amountInr += 50_000;
    const next = applyTradeoffDraft(plan, { summary: "Protect decor", scenarios: [{
      id: "wrong-priority", title: "Protect decor", summary: "Cut food", protectedPriority: "decor", lines,
    }] });
    expect(next.tradeOffScenarios).toEqual(plan.tradeOffScenarios);
  });

  it("adding the same idea twice never charges twice", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    plan.ideas = [{ id: "music", title: "Music", summary: "Acoustic set", occasion: "wedding", estimatedCostInr: 5000, taskTitle: "Arrange music", status: "suggested", source: "local" }];
    const once = applyPlanCommand(plan, { type: "add-idea", ideaId: "music", today: "2026-11-02" });
    expect(once.ok).toBe(true);
    const twice = applyPlanCommand(once.plan, { type: "add-idea", ideaId: "music", today: "2026-11-02" });
    expect(twice.plan.budgetBreakdown).toEqual(once.plan.budgetBreakdown);
    expect(twice.plan.timelineTasks).toEqual(once.plan.timelineTasks);
  });

  it("rejects duplicate task identities and dangling checklist links at the boundary", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    expect(eventPlanSchema.safeParse({ ...plan, timelineTasks: [plan.timelineTasks[0], plan.timelineTasks[0]] }).success).toBe(false);
    expect(eventPlanSchema.safeParse({ ...plan, checklist: [{ id: "broken", title: "Missing task", done: false, taskId: "absent" }] }).success).toBe(false);
  });

  it("keeps vendor budget caps synchronized after a quote is entered", () => {
    const result = applyPlanCommand(buildLocalPlan(FIXTURE_BRIEF), { type: "confirm-quote", category: "venue", amountInr: 123000, vendorName: "Amber Hall" });
    expect(result.plan.vendorBriefs.find((brief) => brief.category === "venue")?.budgetCapInr).toBe(123000);
  });

  it("rejects revisions outside supported bounds instead of silently clamping them", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const result = revisePlan(plan, { guestDelta: -1000, budgetDeltaInr: -5000000, dayShift: 0 }, "2026-11-02");
    expect(result.plan).toBe(plan);
    expect(result.changes).toEqual([]);
    expect(result.warning).toMatch(/guest|budget/i);
  });

  it("uses the actual catering price basis after attendance was applied", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const attendance = applyPlanCommand(plan, { type: "apply-headcount", guestCount: 3, today: "2026-11-02" }).plan;
    const result = revisePlan(attendance, { guestDelta: 50, budgetDeltaInr: 0, dayShift: 0 }, "2026-11-02");
    const price = attendance.budgetBreakdown.find((line) => line.category === "catering")!.amountInr / 3;
    expect(result.plan.budgetBreakdown.find((line) => line.category === "catering")!.amountInr).toBe(Math.round(price * 170));
  });

  it("rounds an AI allocation without creating a negative zero-cost category", () => {
    const brief = { ...FIXTURE_BRIEF, budgetInr: 10003 };
    const local = buildLocalPlan(brief);
    const plan = planFromDraft(brief, {
      rationale: "A small gathering", budgetBreakdown: local.budgetBreakdown.map((line, i) => ({ ...line, amountInr: i === 5 ? 0 : 1 })),
      timelineTasks: local.timelineTasks, tradeOffScenarios: [], vendorBriefs: local.vendorBriefs, checklist: local.checklist.map((item) => item.title),
    });
    expect(plan.budgetBreakdown.every((line) => line.amountInr >= 0)).toBe(true);
    expect(plan.budgetBreakdown.reduce((total, line) => total + line.amountInr, 0)).toBe(10003);
    expect(eventPlanSchema.safeParse(plan).success).toBe(true);
  });
});
