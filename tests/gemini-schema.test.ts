import { describe, expect, it } from "vitest";
import { INITIAL_PLAN_RESPONSE_SCHEMA } from "@/lib/gemini";
import { geminiPlanDraftSchema } from "@/lib/schemas";

describe("gemini response schema", () => {
  it("asks Gemini for budget lines, dependent tasks, and trade-offs", () => {
    expect(INITIAL_PLAN_RESPONSE_SCHEMA.required).toEqual([
      "rationale",
      "budgetBreakdown",
      "timelineTasks",
      "tradeOffScenarios",
      "vendorBriefs",
      "checklist",
    ]);
  });

  it("rejects a draft that omits the estimate flag", () => {
    const parsed = geminiPlanDraftSchema.safeParse({
      rationale: "A draft.",
      budgetBreakdown: [],
      timelineTasks: [],
      tradeOffScenarios: [],
      vendorBriefs: [],
      checklist: [],
    });
    expect(parsed.success).toBe(false);
  });
});
