import { describe, expect, it } from "vitest";
import { geminiPlanDraftSchema } from "@/lib/schemas";
import {
  normalizeConstraintDelta,
  normalizeIdeasDraft,
  normalizePlanDraft,
  normalizePriority,
  normalizeTimelineDraft,
  normalizeTradeoffDraft,
  normalizeVendorDraft,
} from "@/lib/normalize-draft";

const line = (category: string, amountInr: number) => ({
  category,
  amountInr,
  assumption: "Estimated for this occasion.",
  isEstimated: true,
});

describe("draft normalization", () => {
  it("maps loose priorities and category names onto the schema", () => {
    expect(normalizePriority("Urgent")).toBe("high");
    expect(normalizePriority("3")).toBe("low");
    expect(normalizePriority("normal")).toBe("medium");

    const draft = normalizePlanDraft({
      rationale: "A birthday in Pune.",
      budgetBreakdown: ["venue", "catering", "decor", "photography", "entertainment", "miscellaneous"].map((category, index) =>
        index === 1
          ? { category: "Food", amountInr: "48000.4", assumption: "", isEstimated: "false" }
          : line(category, 1000),
      ),
      timelineTasks: [
        { id: "lock-date-venue", title: "Lock the date", ownerHint: "Host", durationDays: 0, dependencies: [], priority: "High", note: "First" },
        { id: "book-catering", title: "Order food", ownerHint: "Host", durationDays: 2, dependencies: ["lock-date-venue"], priority: "medium", note: "Next" },
        { id: "book-decor", title: "Backdrop", ownerHint: "Host", durationDays: 1, dependencies: ["lock-date-venue"], priority: "low", note: "Then" },
      ],
      tradeOffScenarios: [{
        id: "keep-food",
        title: "Keep food",
        summary: "Cut decor.",
        protectedPriority: "Decor",
        lines: [line("catering", 2000)],
      }],
      vendorBriefs: [{ category: "Photos", mustHaves: "A friend with a camera.", questions: ["Who takes the photos?"] }],
      checklist: ["Lock the date", "Order food", "Backdrop"],
    });

    const parsed = geminiPlanDraftSchema.safeParse(draft);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.budgetBreakdown[1]?.category).toBe("catering");
    expect(parsed.data.budgetBreakdown[1]?.amountInr).toBe(48000);
    expect(parsed.data.budgetBreakdown[1]?.isEstimated).toBe(false);
    expect(parsed.data.timelineTasks[0]?.priority).toBe("high");
    expect(parsed.data.timelineTasks[0]?.durationDays).toBe(1);
    expect(parsed.data.tradeOffScenarios[0]?.protectedPriority).toBe("decor");
    expect(parsed.data.vendorBriefs[0]?.category).toBe("photography");
  });

  it("normalizes the other Gemini payloads before validation", () => {
    const tradeoffs = normalizeTradeoffDraft({
      summary: "Keep food.",
      scenarios: [{ id: "a", title: "A", summary: "Cut music.", protectedPriority: "Food", lines: [line("music", 10.2)] }],
    }) as { scenarios: Array<{ protectedPriority: string; lines: Array<{ category: string; amountInr: number }> }> };
    expect(tradeoffs.scenarios[0]?.protectedPriority).toBe("catering");
    expect(tradeoffs.scenarios[0]?.lines[0]).toMatchObject({ category: "entertainment", amountInr: 10 });

    const timeline = normalizeTimelineDraft({
      timelineTasks: [{ id: "book-photo", title: "Photos", note: "Friend", priority: "critical", dependencies: ["", "lock-date-venue"], durationDays: "2.2" }],
    }) as { timelineTasks: Array<{ priority: string; durationDays: number; dependencies: string[] }> };
    expect(timeline.timelineTasks[0]).toMatchObject({ priority: "high", durationDays: 2, dependencies: ["lock-date-venue"] });

    const vendor = normalizeVendorDraft({
      questions: ["GST?"],
      vendorComparisonMatrix: [{ vendorName: "Amber", fitSummary: "Covers food.", hiddenChargeNotes: [" GST extra "], isEstimated: false }],
    }) as { vendorComparisonMatrix: Array<{ isEstimated: boolean; hiddenChargeNotes: string[] }> };
    expect(vendor.vendorComparisonMatrix[0]).toMatchObject({ isEstimated: true, hiddenChargeNotes: ["GST extra"] });

    const ideas = normalizeIdeasDraft({
      ideas: [{ id: "games", title: "Games", summary: "A playlist.", estimatedCostInr: "1500.6", taskTitle: " Choose games " }],
    }) as { ideas: Array<{ estimatedCostInr: number; taskTitle: string }> };
    expect(ideas.ideas[0]).toMatchObject({ estimatedCostInr: 1501, taskTitle: "Choose games" });

    expect(normalizeConstraintDelta({
      guestDelta: "10",
      budgetDeltaInr: "-200000",
      dayShift: "-14",
      absoluteEventDate: "",
      ambiguous: "",
    })).toMatchObject({ guestDelta: 10, budgetDeltaInr: -200000, dayShift: -14, absoluteEventDate: null, ambiguous: null });
  });
});
