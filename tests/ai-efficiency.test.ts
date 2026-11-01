import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalPlan } from "@/domain/local-plan";
import { buildAiContext } from "@/lib/ai-context";
import { compareVendorQuotes, extractConstraintDelta, generateIdeas, generateInitialEventPlan, recalculateBudgetTradeoffs, rescheduleTimelineWithDependencies, reviseEventPlan } from "@/lib/gemini";
import { FIXTURE_BRIEF } from "./brief";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", async (original) => ({
  ...await original<object>(),
  GoogleGenAI: class { models = { generateContent }; },
}));

const ideaResponse = { text: JSON.stringify({ ideas: [{ id: "games", title: "Games", summary: "Accessible table games", estimatedCostInr: 500, taskTitle: "Prepare games" }] }) };

describe("bounded AI work", () => {
  beforeEach(() => { generateContent.mockReset(); vi.stubEnv("GEMINI_API_KEY", "test-server-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("sends only operation-relevant aggregates and no guest identities", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    plan.guests = [{ id: "private", name: "Private Guest", email: "private@example.org", partySize: 2, status: "yes", mealNote: "" }];
    const context = buildAiContext(plan, "tradeoffs");
    expect(context).toHaveProperty("budgetBreakdown");
    expect(context).not.toHaveProperty("timelineTasks");
    expect(context).not.toHaveProperty("vendorBriefs");
    expect(JSON.stringify(context)).not.toMatch(/Private Guest|private@example/);
  });

  it("never drops timeline IDs from large valid context", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    plan.timelineTasks = Array.from({ length: 40 }, (_, i) => ({ ...plan.timelineTasks[0], id: `task-${i}`, note: "x".repeat(400) }));
    const context = buildAiContext(plan, "timeline") as { timelineTasks: Array<{ id: string }> };
    expect(context.timelineTasks.map((task) => task.id)).toEqual(plan.timelineTasks.map((task) => task.id));
    expect(JSON.stringify(context).length).toBeLessThan(16_000);
  });

  it("coalesces simultaneous identical requests and bounds model output", async () => {
    let finish!: (value: typeof ideaResponse) => void;
    generateContent.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const first = generateIdeas(plan);
    const second = generateIdeas(plan);
    expect(generateContent).toHaveBeenCalledTimes(1);
    finish(ideaResponse);
    await expect(first).resolves.toHaveLength(1);
    await expect(second).resolves.toHaveLength(1);
    expect(generateContent.mock.calls[0][0].config).toMatchObject({ maxOutputTokens: 4096, httpOptions: { retryOptions: { attempts: 1 } } });
  });

  it("aborts the SDK operation at the shared deadline and does not retry an expired request", async () => {
    vi.useFakeTimers();
    generateContent.mockImplementation(() => new Promise(() => {}));
    const pending = generateIdeas(buildLocalPlan(FIXTURE_BRIEF));
    const failure = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(20_000);
    await failure;
    expect(generateContent.mock.calls[0][0].config.abortSignal.aborted).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure once, but never caches a failed response", async () => {
    generateContent.mockRejectedValueOnce(new Error("503 UNAVAILABLE")).mockResolvedValue(ideaResponse);
    await expect(generateIdeas(buildLocalPlan(FIXTURE_BRIEF))).resolves.toHaveLength(1);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("requires a key without calling the provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateIdeas(buildLocalPlan(FIXTURE_BRIEF))).rejects.toThrow(/not set/);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ["401 API key invalid AIzaThisMustNotLeak", /rejected the API key/],
    ["404 model not found", /model is not available/],
    ["a private internal error", /did not return a usable plan/],
  ])("returns a safe failure for %s", async (message, expected) => {
    generateContent.mockRejectedValue(new Error(message));
    await expect(generateIdeas(buildLocalPlan(FIXTURE_BRIEF))).rejects.toThrow(expected);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("discards invalid model JSON and permits a fresh retry by the host", async () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    generateContent.mockResolvedValueOnce({ text: "not JSON" }).mockResolvedValueOnce(ideaResponse);
    await expect(generateIdeas(plan)).rejects.toThrow(/usable plan/);
    await expect(generateIdeas(plan)).resolves.toHaveLength(1);
  });

  it("validates and normalizes every structured provider operation", async () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const respond = (data: unknown) => generateContent.mockResolvedValueOnce({ text: JSON.stringify(data) });
    respond({ rationale: "Accessible wedding", budgetBreakdown: plan.budgetBreakdown, timelineTasks: plan.timelineTasks, tradeOffScenarios: [], vendorBriefs: plan.vendorBriefs, checklist: plan.checklist.map((item) => item.title) });
    await expect(generateInitialEventPlan(FIXTURE_BRIEF)).resolves.toHaveProperty("timelineTasks");
    const scenario = { id: "food", title: "Food first", summary: "Protect food", protectedPriority: "catering", lines: plan.budgetBreakdown };
    respond({ summary: "Protect food", scenarios: [scenario] });
    await expect(recalculateBudgetTradeoffs(plan)).resolves.toHaveProperty("scenarios");
    respond({ questions: ["GST?", "Deposit?", "Access?"], vendorComparisonMatrix: [] });
    await expect(compareVendorQuotes({ category: "venue", city: "Jaipur", occasion: "wedding", mustHaves: "Access", guestCoverage: 120, budgetCapInr: 100000, quotes: [] })).resolves.toHaveProperty("questions");
    respond({ timelineTasks: plan.timelineTasks });
    await expect(rescheduleTimelineWithDependencies(plan, "2026-12-06")).resolves.toHaveProperty("timelineTasks");
    respond({ guestDelta: 50, budgetDeltaInr: -200000, dayShift: -14, absoluteGuestCount: null, absoluteBudgetInr: null, absoluteEventDate: null, ambiguous: null });
    await expect(extractConstraintDelta(plan, "Please revise")).resolves.toEqual({ guestDelta: 50, budgetDeltaInr: -200000, dayShift: -14 });
  });

  it("keeps a successful advisory when the other independent call fails", async () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    generateContent.mockImplementation(({ contents }: { contents: string }) => {
      if (JSON.parse(contents).timelineTasks) return Promise.resolve({ text: JSON.stringify({ timelineTasks: plan.timelineTasks }) });
      return Promise.reject(new Error("401 key rejected"));
    });
    const result = await reviseEventPlan(plan, "50 more guests");
    expect(result.tradeoffs).toBeNull();
    expect(result.timeline?.timelineTasks).toHaveLength(plan.timelineTasks.length);
  });

  it("skips advisory operations outside the changed constraint scope", async () => {
    await expect(reviseEventPlan(buildLocalPlan(FIXTURE_BRIEF), "No date change", { tradeoffs: false, timeline: false })).resolves.toEqual({ tradeoffs: null, timeline: null });
    expect(generateContent).not.toHaveBeenCalled();
  });
});
