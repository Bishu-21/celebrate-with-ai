import { CATEGORIES, type Category } from "@/domain/types";

const CATEGORY_SET = new Set<string>(CATEGORIES);
const CATEGORY_ALIAS: Record<string, Category> = {
  venue: "venue",
  catering: "catering",
  food: "catering",
  meal: "catering",
  meals: "catering",
  decor: "decor",
  decoration: "decor",
  decorations: "decor",
  photography: "photography",
  photo: "photography",
  photos: "photography",
  entertainment: "entertainment",
  music: "entertainment",
  miscellaneous: "miscellaneous",
  misc: "miscellaneous",
  other: "miscellaneous",
};

const ESTIMATE_ASSUMPTION = "Gemini estimate. Not a confirmed vendor price.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeCategory(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  if (CATEGORY_SET.has(text)) return text;
  return CATEGORY_ALIAS[text] ?? text;
}

export function normalizePriority(value: unknown): "high" | "medium" | "low" {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.startsWith("h") || text === "1" || text.includes("urgent") || text.includes("critical")) return "high";
  if (text.startsWith("l") || text === "3") return "low";
  return "medium";
}

export function normalizeLine(value: unknown): Record<string, unknown> {
  const line = asRecord(value);
  const assumption = String(line.assumption ?? ESTIMATE_ASSUMPTION).trim().slice(0, 400) || ESTIMATE_ASSUMPTION;
  return {
    ...line,
    category: normalizeCategory(line.category),
    amountInr: clampInt(line.amountInr, 0, 50_000_000, 0),
    assumption,
    isEstimated: line.isEstimated !== false && line.isEstimated !== "false",
  };
}

function normalizeTask(value: unknown): Record<string, unknown> {
  const item = asRecord(value);
  const dependencies = Array.isArray(item.dependencies)
    ? item.dependencies.map((dependency) => String(dependency).trim()).filter(Boolean).slice(0, 12)
    : item.dependencies;
  return {
    ...item,
    priority: normalizePriority(item.priority),
    durationDays: clampInt(item.durationDays, 1, 120, 1),
    dependencies,
  };
}

export function normalizePlanDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(draft.budgetBreakdown)) draft.budgetBreakdown = draft.budgetBreakdown.map(normalizeLine);
  if (Array.isArray(draft.timelineTasks)) draft.timelineTasks = draft.timelineTasks.map(normalizeTask);
  if (Array.isArray(draft.tradeOffScenarios)) {
    draft.tradeOffScenarios = draft.tradeOffScenarios.map((scenario) => {
      const item = asRecord(scenario);
      return {
        ...item,
        protectedPriority: normalizeCategory(item.protectedPriority),
        lines: Array.isArray(item.lines) ? item.lines.map(normalizeLine) : item.lines,
      };
    });
  }
  if (Array.isArray(draft.vendorBriefs)) {
    draft.vendorBriefs = draft.vendorBriefs.map((brief) => {
      const item = asRecord(brief);
      return { ...item, category: normalizeCategory(item.category) };
    });
  }
  return draft;
}

export function normalizeTradeoffDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(draft.scenarios)) {
    draft.scenarios = draft.scenarios.map((scenario) => {
      const item = asRecord(scenario);
      return {
        ...item,
        protectedPriority: normalizeCategory(item.protectedPriority),
        lines: Array.isArray(item.lines) ? item.lines.map(normalizeLine) : item.lines,
      };
    });
  }
  return draft;
}

export function normalizeTimelineDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(draft.timelineTasks)) draft.timelineTasks = draft.timelineTasks.map(normalizeTask);
  return draft;
}

export function normalizeVendorDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(draft.vendorComparisonMatrix)) {
    draft.vendorComparisonMatrix = draft.vendorComparisonMatrix.map((row) => {
      const item = asRecord(row);
      const notes = item.hiddenChargeNotes;
      return {
        ...item,
        isEstimated: true,
        hiddenChargeNotes: Array.isArray(notes)
          ? notes.map((note) => String(note).trim()).filter(Boolean).slice(0, 6)
          : notes,
      };
    });
  }
  return draft;
}

export function normalizeIdeasDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(draft.ideas)) {
    draft.ideas = draft.ideas.map((idea) => {
      const item = asRecord(idea);
      return {
        ...item,
        estimatedCostInr: clampInt(item.estimatedCostInr, 0, 50_000_000, 0),
        taskTitle: String(item.taskTitle ?? "").trim().slice(0, 140),
      };
    });
  }
  return draft;
}

function nullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function normalizeConstraintDelta(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  const date = value.absoluteEventDate == null || value.absoluteEventDate === ""
    ? null
    : String(value.absoluteEventDate).trim().slice(0, 10);
  const ambiguous = value.ambiguous == null || value.ambiguous === ""
    ? null
    : String(value.ambiguous).trim().slice(0, 300);
  return {
    ...value,
    guestDelta: nullableInt(value.guestDelta) ?? 0,
    absoluteGuestCount: nullableInt(value.absoluteGuestCount),
    budgetDeltaInr: nullableInt(value.budgetDeltaInr) ?? 0,
    absoluteBudgetInr: nullableInt(value.absoluteBudgetInr),
    dayShift: nullableInt(value.dayShift) ?? 0,
    absoluteEventDate: date,
    ambiguous,
  };
}
