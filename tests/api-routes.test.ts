import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalPlan } from "@/domain/local-plan";
import { eventPlanSchema } from "@/lib/schemas";
import * as ai from "@/lib/gemini";
import { POST as generate } from "@/app/api/plan/generate/route";
import { POST as revise } from "@/app/api/plan/revise/route";
import { POST as tradeoffs } from "@/app/api/plan/tradeoffs/route";
import { POST as timeline } from "@/app/api/plan/timeline/route";
import { POST as ideas } from "@/app/api/plan/ideas/route";
import { POST as compare } from "@/app/api/vendors/compare/route";
import { POST as questions } from "@/app/api/vendors/questions/route";
import { FIXTURE_BRIEF } from "./brief";

vi.mock("@/lib/gemini", () => ({
  generateInitialEventPlan: vi.fn(), reviseEventPlan: vi.fn(), extractConstraintDelta: vi.fn(),
  recalculateBudgetTradeoffs: vi.fn(), rescheduleTimelineWithDependencies: vi.fn(), generateIdeas: vi.fn(), compareVendorQuotes: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ clientKey: () => "route-test", rateLimit: () => ({ ok: true }) }));

const plan = { ...buildLocalPlan(FIXTURE_BRIEF, { id: "route-event", today: "2026-11-02" }), source: "gemini" as const };
const post = (body: unknown) => new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) });
const vendorInput = { category: "venue", mustHaves: "Step-free access", guestCoverage: 120, budgetCapInr: 100000, occasion: "wedding", city: "Jaipur" };

describe("planning API contracts and degraded operation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects invalid requests before spending provider calls on every route", async () => {
    for (const handler of [generate, revise, tradeoffs, timeline, ideas, compare, questions]) {
      expect((await handler(post({}))).status).toBe(400);
    }
    for (const method of Object.values(ai)) expect(method).not.toHaveBeenCalled();
  });

  it("generates a complete validated event and never invents a first AI plan on failure", async () => {
    vi.mocked(ai.generateInitialEventPlan).mockResolvedValue({ rationale: "Personalized wedding", budgetBreakdown: plan.budgetBreakdown, timelineTasks: plan.timelineTasks, tradeOffScenarios: [], vendorBriefs: plan.vendorBriefs, checklist: plan.checklist.map((item) => item.title) });
    const response = await generate(post({ brief: FIXTURE_BRIEF }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(eventPlanSchema.safeParse(data.plan).success).toBe(true);
    expect(data.source).toBe("gemini");
    vi.mocked(ai.generateInitialEventPlan).mockRejectedValue(new Error("Gemini rejected the API key."));
    expect((await generate(post({ brief: FIXTURE_BRIEF }))).status).toBe(502);
  });

  it("revises all three constraints without losing completed work when advisory AI fails", async () => {
    vi.mocked(ai.reviseEventPlan).mockResolvedValue({ tradeoffs: null, timeline: null });
    const before = { ...plan, timelineTasks: plan.timelineTasks.map((task, i) => i === 0 ? { ...task, status: "done" as const } : task) };
    const response = await revise(post({ plan: before, instruction: "50 more guests, budget dropped by ₹2,00,000, event 2 weeks earlier", today: "2026-11-02", baseRevision: 4 }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ source: "local", baseRevision: 4, plan: { id: before.id, guestCount: 170, budgetInr: 1300000, eventDate: "2026-12-06" } });
    expect(data.plan.timelineTasks[0].status).toBe("done");
    expect(eventPlanSchema.safeParse(data.plan).success).toBe(true);
    expect(ai.extractConstraintDelta).not.toHaveBeenCalled();
  });

  it("preserves a locked quote in locally computed trade-offs", async () => {
    vi.mocked(ai.recalculateBudgetTradeoffs).mockRejectedValue(new Error("quota"));
    const before = { ...plan, budgetInr: 1300000, budgetBreakdown: plan.budgetBreakdown.map((line, i) => i === 0 ? { ...line, isEstimated: false, origin: "quote" as const } : line) };
    const data = await (await tradeoffs(post({ plan: before }))).json();
    expect(data.source).toBe("local");
    for (const scenario of data.plan.tradeOffScenarios) expect(scenario.lines[0]).toEqual(before.budgetBreakdown[0]);
  });

  it("reschedules with the same task IDs when timeline notes are unavailable", async () => {
    vi.mocked(ai.rescheduleTimelineWithDependencies).mockRejectedValue(new Error("quota"));
    const data = await (await timeline(post({ plan, eventDate: "2026-12-06", today: "2026-11-02" }))).json();
    expect(data.source).toBe("local");
    expect(data.plan.timelineTasks.map((task: { id: string }) => task.id)).toEqual(plan.timelineTasks.map((task) => task.id));
    expect(eventPlanSchema.safeParse(data.plan).success).toBe(true);
  });

  it("returns occasion-specific local ideas and honest provenance on provider failure", async () => {
    vi.mocked(ai.generateIdeas).mockRejectedValue(new Error("quota"));
    const data = await (await ideas(post({ plan: { ...plan, occasion: "birthday" } }))).json();
    expect(data.source).toBe("local");
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((idea: { occasion: string; source: string }) => idea.occasion === "birthday" && idea.source === "local")).toBe(true);
  });

  it("scores vendor facts without AI and produces usable fallback questions", async () => {
    vi.mocked(ai.compareVendorQuotes).mockRejectedValue(new Error("quota"));
    const quotes = [0, 1].map((i) => ({ id: `v${i}`, category: "venue", vendorName: `Hall ${i}`, amountInr: 50000 + i * 100000, guestCoverage: 100 + i * 50, included: ["Chairs"], notes: "GST extra", isEstimated: false }));
    const data = await (await compare(post({ ...vendorInput, quotes, headcount: 120, capInr: 100000 }))).json();
    expect(data.source).toBe("local");
    expect(data.vendorComparisonMatrix[0]).toMatchObject({ coversHeadcount: false, withinCap: true, hiddenChargeNotes: ["GST extra"] });
    expect(data.vendorComparisonMatrix[1]).toMatchObject({ coversHeadcount: true, withinCap: false });
    expect(data.vendorComparisonMatrix[0]).not.toHaveProperty("availability");
    const questionData = await (await questions(post(vendorInput))).json();
    expect(questionData.source).toBe("local");
    expect(questionData.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("merges successful advisory notes without changing task identity or quoted facts", async () => {
    vi.mocked(ai.rescheduleTimelineWithDependencies).mockResolvedValue({ timelineTasks: plan.timelineTasks.map((task) => ({ ...task, note: "Check the revised lead time" })) });
    const timelineData = await (await timeline(post({ plan, eventDate: "2026-12-06", today: "2026-11-02" }))).json();
    expect(timelineData.source).toBe("gemini");
    expect(timelineData.plan.timelineTasks[0].note).toBe("Check the revised lead time");
    vi.mocked(ai.reviseEventPlan).mockResolvedValue({ tradeoffs: null, timeline: { timelineTasks: plan.timelineTasks.map((task) => ({ ...task, note: "Updated note" })) } });
    const revision = await (await revise(post({ plan, instruction: "event 2 weeks earlier", today: "2026-11-02" }))).json();
    expect(revision.source).toBe("gemini");
    expect(revision.plan.timelineTasks[0].note).toBe("Updated note");
  });

  it("returns successful idea generation with explicit estimate provenance", async () => {
    vi.mocked(ai.generateIdeas).mockResolvedValue([{ id: "games", title: "Games", summary: "Accessible games", estimatedCostInr: 1000, taskTitle: "Arrange games" }]);
    const data = await (await ideas(post({ plan }))).json();
    expect(data).toMatchObject({ source: "gemini", ideas: [{ id: "games", status: "suggested", source: "gemini", occasion: "wedding" }] });
  });

  it("renders AI commentary alongside deterministic vendor coverage and charge facts", async () => {
    vi.mocked(ai.compareVendorQuotes).mockResolvedValue({ questions: ["GST?", "Deposit?", "Access?"], vendorComparisonMatrix: [{ quoteId: "v0", vendorName: "Hall 0", fitSummary: "Ask about access", hiddenChargeNotes: [], isEstimated: true }] });
    const quotes = [0, 1].map((i) => ({ id: `v${i}`, category: "venue", vendorName: `Hall ${i}`, amountInr: 50000, guestCoverage: 100, included: ["Chairs"], notes: "GST extra", isEstimated: false }));
    const data = await (await compare(post({ ...vendorInput, quotes, headcount: 120, capInr: 100000 }))).json();
    expect(data.source).toBe("gemini");
    expect(data.vendorComparisonMatrix[0]).toMatchObject({ fitSummary: "Ask about access", coversHeadcount: false, hiddenChargeNotes: ["GST extra"] });
    const questionData = await (await questions(post(vendorInput))).json();
    expect(questionData.questions).toHaveLength(3);
  });
});
