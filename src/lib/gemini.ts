import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { CATEGORIES, type Category, type ConstraintDelta, type EventBrief, type EventPlan } from "@/domain/types";
import { buildAiContext } from "@/lib/ai-context";
import {
  normalizeConstraintDelta,
  normalizeIdeasDraft,
  normalizePlanDraft,
  normalizeTimelineDraft,
  normalizeTradeoffDraft,
  normalizeVendorDraft,
} from "@/lib/normalize-draft";
import {
  constraintDeltaSchema,
  geminiIdeasSchema,
  geminiPlanDraftSchema,
  geminiTimelineDraftSchema,
  geminiTradeoffDraftSchema,
  geminiVendorDraftSchema,
  type GeminiPlanDraft,
  type GeminiTimelineDraft,
  type GeminiTradeoffDraft,
  type GeminiVendorDraft,
} from "@/lib/schemas";

const MODEL_DEFAULT = "gemini-3.5-flash-lite";
const CATEGORY_ENUM = [...CATEGORIES];
const CATEGORY_LIST = CATEGORY_ENUM.join(", ");
const PRIORITY_ENUM = ["high", "medium", "low"];

function moneyLineSchema(): Schema {
  return {
    type: Type.OBJECT,
    required: ["category", "amountInr", "assumption", "isEstimated"],
    properties: {
      category: { type: Type.STRING, enum: [...CATEGORY_ENUM] },
      amountInr: { type: Type.INTEGER },
      assumption: { type: Type.STRING },
      isEstimated: { type: Type.BOOLEAN },
    },
  };
}

export const INITIAL_PLAN_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["rationale", "budgetBreakdown", "timelineTasks", "tradeOffScenarios", "vendorBriefs", "checklist"],
  properties: {
    rationale: { type: Type.STRING },
    budgetBreakdown: { type: Type.ARRAY, items: moneyLineSchema() },
    timelineTasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["id", "title", "ownerHint", "durationDays", "dependencies", "priority", "note"],
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          ownerHint: { type: Type.STRING },
          durationDays: { type: Type.INTEGER },
          dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
          priority: { type: Type.STRING, enum: [...PRIORITY_ENUM] },
          note: { type: Type.STRING },
        },
      },
    },
    tradeOffScenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["id", "title", "summary", "protectedPriority", "lines"],
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          protectedPriority: { type: Type.STRING, enum: [...CATEGORY_ENUM] },
          lines: { type: Type.ARRAY, items: moneyLineSchema() },
        },
      },
    },
    vendorBriefs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["category", "mustHaves", "questions"],
        properties: {
          category: { type: Type.STRING, enum: [...CATEGORY_ENUM] },
          mustHaves: { type: Type.STRING },
          questions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

const TRADEOFF_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["summary", "scenarios"],
  properties: {
    summary: { type: Type.STRING },
    scenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["id", "title", "summary", "protectedPriority", "lines"],
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          protectedPriority: { type: Type.STRING, enum: [...CATEGORY_ENUM] },
          lines: { type: Type.ARRAY, items: moneyLineSchema() },
        },
      },
    },
  },
};

const VENDOR_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["questions", "vendorComparisonMatrix"],
  properties: {
    questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    vendorComparisonMatrix: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["vendorName", "fitSummary", "hiddenChargeNotes", "isEstimated"],
        properties: {
          quoteId: { type: Type.STRING },
          vendorName: { type: Type.STRING },
          fitSummary: { type: Type.STRING },
          hiddenChargeNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          isEstimated: { type: Type.BOOLEAN },
        },
      },
    },
  },
};

const TIMELINE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["timelineTasks"],
  properties: {
    timelineTasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["id", "title", "note", "priority", "dependencies", "durationDays"],
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          note: { type: Type.STRING },
          priority: { type: Type.STRING, enum: [...PRIORITY_ENUM] },
          dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
          durationDays: { type: Type.INTEGER },
        },
      },
    },
  },
};

const ESTIMATE_RULE =
  "Every cost is an assumption. Set isEstimated to true. Never present a number as a confirmed vendor price or as live availability.";

let cachedClient: { apiKey: string; client: GoogleGenAI } | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (cachedClient?.apiKey === apiKey) return cachedClient.client;
  cachedClient = { apiKey, client: new GoogleGenAI({ apiKey }) };
  return cachedClient.client;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Model did not return JSON.");
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}

function safeGeminiMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Gemini request failed.";
  const cleaned = raw.replace(/AQ\.[A-Za-z0-9._-]+/g, "[key]").replace(/AIza[0-9A-Za-z_-]+/g, "[key]");
  if (/API key|UNAUTHENTICATED|PERMISSION_DENIED|401|403/i.test(cleaned)) return "Gemini rejected the API key.";
  if (/429|RESOURCE_EXHAUSTED|quota|rate/i.test(cleaned)) return "Gemini is rate limiting requests. Wait and try again.";
  if (/not found|404|model/i.test(cleaned)) return "The configured Gemini model is not available.";
  return "Gemini did not return a usable plan.";
}

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|ETIMEDOUT|fetch failed|timed out/i.test(message);
}

async function withDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Gemini timed out.")), milliseconds);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateJson(systemInstruction: string, prompt: string, responseSchema: Schema): Promise<unknown> {
  if (prompt.length > 100_000) throw new Error("Gemini context is too large to send.");
  const ai = getClient();
  if (!ai) throw new Error("GEMINI_API_KEY is not set on the server.");
  const started = Date.now();
  const call = () =>
    withDeadline(
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL?.trim() || MODEL_DEFAULT,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }),
      Math.max(1_000, 20_000 - (Date.now() - started)),
    );
  try {
    let response: Awaited<ReturnType<typeof call>>;
    try {
      response = await call();
    } catch (error) {
      if (!isTransient(error) || Date.now() - started > 15_000) throw error;
      response = await call();
    }
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini returned an empty response.");
    return parseModelJson(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Gemini")) throw error;
    throw new Error(safeGeminiMessage(error));
  }
}

function schemaDetail(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues.slice(0, 4).map((issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`).join("; ");
}

export async function generateInitialEventPlan(brief: EventBrief): Promise<GeminiPlanDraft> {
  const parsed = await generateJson(
    [
      "You are Marigold, a celebration planner for weddings, birthdays, and community events.",
      "Return a practical plan for this brief. Use categories:",
      CATEGORY_LIST + ".",
      "Tasks and checklist items must fit the occasion. A birthday is cake, games, and a simple photo plan, not wedding rituals. A community event is permissions, volunteers, and a shared meal, not a wedding vendor list. A wedding can include the ceremony order.",
      "timelineTasks must include dependencies. Locking the venue and date comes before secondary vendors.",
      "budgetBreakdown must include every category and the amounts should aim to sum to budgetInr.",
      ESTIMATE_RULE,
    ].join(" "),
    JSON.stringify(brief),
    INITIAL_PLAN_RESPONSE_SCHEMA,
  );
  const result = geminiPlanDraftSchema.safeParse(normalizePlanDraft(parsed));
  if (!result.success) throw new Error(`Gemini returned a plan that did not match the schema. ${schemaDetail(result.error.issues)}`);
  return result.data;
}

export async function recalculateBudgetTradeoffs(plan: EventPlan, instruction = ""): Promise<GeminiTradeoffDraft> {
  const parsed = await generateJson(
    [
      "Propose budget trade-off scenarios for an existing celebration plan.",
      "Protect the first item in priorities. Do not make that category the deepest cut.",
      "Amounts in each scenario must sum to budgetInr.",
      ESTIMATE_RULE,
    ].join(" "),
    JSON.stringify({ instruction, ...buildAiContext(plan) }),
    TRADEOFF_RESPONSE_SCHEMA,
  );
  const result = geminiTradeoffDraftSchema.safeParse(normalizeTradeoffDraft(parsed));
  if (!result.success) throw new Error(`Gemini returned trade-offs that did not match the schema. ${schemaDetail(result.error.issues)}`);
  return result.data;
}

export async function compareVendorQuotes(input: {
  category: Category;
  mustHaves: string;
  guestCoverage: number;
  budgetCapInr: number;
  occasion: string;
  city: string;
  quotes: Array<{ quoteId: string; vendorName: string; amountInr: number; guestCoverage: number; included: string[]; notes: string }>;
}): Promise<GeminiVendorDraft> {
  const parsed = await generateJson(
    [
      "Write questions a host should ask this vendor, then compare the quotations the host already collected.",
      "Do not invent live availability. hiddenChargeNotes should quote likely extras already mentioned in the notes, such as GST, overtime, or transport.",
      "Set isEstimated to true on every matrix row.",
      ESTIMATE_RULE,
    ].join(" "),
    JSON.stringify(input),
    VENDOR_RESPONSE_SCHEMA,
  );
  const result = geminiVendorDraftSchema.safeParse(normalizeVendorDraft(parsed));
  if (!result.success) throw new Error(`Gemini returned a vendor comparison that did not match the schema. ${schemaDetail(result.error.issues)}`);
  return result.data;
}

export async function rescheduleTimelineWithDependencies(plan: EventPlan, eventDate: string): Promise<GeminiTimelineDraft> {
  const parsed = await generateJson(
    [
      "Rewrite timeline task notes for the same task ids after the event date changes.",
      "Keep every existing id. Keep dependencies that still point at those ids.",
      "Do not drop tasks that are already done. Venue and date lock stays before secondary vendors.",
    ].join(" "),
    JSON.stringify({ eventDate, ...buildAiContext(plan) }),
    TIMELINE_RESPONSE_SCHEMA,
  );
  const result = geminiTimelineDraftSchema.safeParse(normalizeTimelineDraft(parsed));
  if (!result.success) throw new Error(`Gemini returned a timeline that did not match the schema. ${schemaDetail(result.error.issues)}`);
  return result.data;
}

export async function reviseEventPlan(
  plan: EventPlan,
  instruction: string,
  scope: { tradeoffs: boolean; timeline: boolean } = { tradeoffs: true, timeline: true },
): Promise<{
  tradeoffs: GeminiTradeoffDraft | null;
  timeline: GeminiTimelineDraft | null;
}> {
  const [tradeoffs, timeline] = await Promise.allSettled([
    scope.tradeoffs ? recalculateBudgetTradeoffs(plan, instruction) : Promise.resolve(null),
    scope.timeline ? rescheduleTimelineWithDependencies(plan, plan.eventDate) : Promise.resolve(null),
  ]);
  return {
    tradeoffs: tradeoffs.status === "fulfilled" ? tradeoffs.value : null,
    timeline: timeline.status === "fulfilled" ? timeline.value : null,
  };
}

export async function extractConstraintDelta(plan: EventPlan, instruction: string): Promise<ConstraintDelta> {
  const parsed = await generateJson(
    [
      "Read one revision note and return only the numeric changes the host stated.",
      "Use 0 or null when a value is not stated. Do not invent a change.",
      "1 lakh is 100000 rupees. 1 crore is 10000000 rupees.",
      "absoluteEventDate must be YYYY-MM-DD or null.",
      "If the note contradicts itself, set ambiguous to a short reason and leave the other fields empty.",
      "Do not use guest names.",
    ].join(" "),
    JSON.stringify({
      instruction,
      eventDate: plan.eventDate,
      guestCount: plan.guestCount,
      budgetInr: plan.budgetInr,
    }),
    {
      type: Type.OBJECT,
      required: ["guestDelta", "budgetDeltaInr", "dayShift"],
      properties: {
        guestDelta: { type: Type.INTEGER },
        absoluteGuestCount: { type: Type.INTEGER, nullable: true },
        budgetDeltaInr: { type: Type.INTEGER },
        absoluteBudgetInr: { type: Type.INTEGER, nullable: true },
        dayShift: { type: Type.INTEGER },
        absoluteEventDate: { type: Type.STRING, nullable: true },
        ambiguous: { type: Type.STRING, nullable: true },
      },
    },
  );
  const result = constraintDeltaSchema.safeParse(normalizeConstraintDelta(parsed));
  if (!result.success) throw new Error("Gemini returned a revision that did not match the schema.");
  const delta: ConstraintDelta = {
    guestDelta: result.data.guestDelta,
    budgetDeltaInr: result.data.budgetDeltaInr,
    dayShift: result.data.dayShift,
  };
  if (result.data.absoluteGuestCount) delta.absoluteGuestCount = result.data.absoluteGuestCount;
  if (result.data.absoluteBudgetInr) delta.absoluteBudgetInr = result.data.absoluteBudgetInr;
  if (result.data.absoluteEventDate && /^\d{4}-\d{2}-\d{2}$/.test(result.data.absoluteEventDate)) delta.absoluteEventDate = result.data.absoluteEventDate;
  if (result.data.ambiguous) delta.ambiguous = result.data.ambiguous;
  return delta;
}

export async function generateIdeas(plan: EventPlan): Promise<Array<{ id: string; title: string; summary: string; estimatedCostInr: number; taskTitle: string }>> {
  const parsed = await generateJson(
    [
      "Suggest celebration ideas for this occasion only.",
      "A birthday must not receive wedding rituals. A community event must not receive a wedding vendor list.",
      "Costs are assumptions. Do not claim a vendor is available.",
      "Use only the aggregates. Do not ask for guest names.",
    ].join(" "),
    JSON.stringify(buildAiContext(plan)),
    {
      type: Type.OBJECT,
      required: ["ideas"],
      properties: {
        ideas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["id", "title", "summary", "estimatedCostInr", "taskTitle"],
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              estimatedCostInr: { type: Type.INTEGER },
              taskTitle: { type: Type.STRING },
            },
          },
        },
      },
    },
  );
  const result = geminiIdeasSchema.safeParse(normalizeIdeasDraft(parsed));
  if (!result.success) throw new Error(`Gemini returned ideas that did not match the schema. ${schemaDetail(result.error.issues)}`);
  return result.data.ideas;
}
