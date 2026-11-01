import { z } from "zod";
import { CATEGORIES, GUEST_STATUSES, OCCASIONS, TASK_STATUSES, VIBES } from "@/domain/types";

const categorySchema = z.enum(CATEGORIES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const realDate = isoDate.refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Use a real calendar date.");

export const eventBriefSchema = z.object({
  occasion: z.enum(OCCASIONS),
  title: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  eventDate: realDate,
  guestCount: z.number().int().min(1).max(5000),
  budgetInr: z.number().int().min(10_000).max(50_000_000),
  vibe: z.enum(VIBES),
  priorities: z.array(categorySchema).min(1).max(CATEGORIES.length).refine((items) => new Set(items).size === items.length, "Priorities must be unique."),
  notes: z.string().trim().max(1000),
});

export const budgetLineSchema = z.object({
  category: categorySchema,
  amountInr: z.number().int().min(0).max(50_000_000),
  assumption: z.string().trim().min(1).max(400),
  isEstimated: z.boolean(),
  origin: z.enum(["local", "gemini", "quote", "manual"]).optional(),
  selectedQuoteId: z.string().trim().min(1).max(80).nullable().optional(),
});

export const timelineTaskSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(140),
  ownerHint: z.string().trim().max(80),
  durationDays: z.number().int().min(1).max(120),
  dependencies: z.array(z.string().trim().min(1).max(80)).max(12),
  priority: z.enum(["high", "medium", "low"]),
  status: z.enum(TASK_STATUSES),
  dueDate: realDate,
  overdue: z.boolean(),
  note: z.string().max(400),
});

export const guestSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().max(120),
  partySize: z.number().int().min(1).max(20),
  status: z.enum(GUEST_STATUSES),
  mealNote: z.string().trim().max(160),
}).superRefine((guest, context) => {
  if (guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email or leave it blank.", path: ["email"] });
  }
});

export const quoteSchema = z.object({
  id: z.string().trim().min(1).max(80),
  vendorName: z.string().trim().min(2).max(80),
  category: categorySchema,
  amountInr: z.number().int().min(0).max(50_000_000),
  guestCoverage: z.number().int().min(0).max(5000),
  included: z.array(z.string().trim().min(1).max(120)).max(12),
  notes: z.string().trim().max(500),
  isEstimated: z.boolean(),
});

const planFields = {
  id: z.string().trim().min(3).max(80),
  rationale: z.string().trim().max(800),
  source: z.enum(["gemini", "local"]),
  budgetBreakdown: z.array(budgetLineSchema).min(1).max(8),
  timelineTasks: z.array(timelineTaskSchema).max(40),
  tradeOffScenarios: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(400),
    lines: z.array(budgetLineSchema).min(1).max(8),
    protectedPriority: categorySchema,
  })).max(6),
  vendorBriefs: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    category: categorySchema,
    mustHaves: z.string().trim().max(400),
    guestCoverage: z.number().int().min(0).max(5000),
    budgetCapInr: z.number().int().min(0).max(50_000_000),
    questions: z.array(z.string().trim().min(1).max(240)).max(8),
  })).max(8),
  quotes: z.array(quoteSchema).max(20),
  guests: z.array(guestSchema).max(500),
  checklist: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    done: z.boolean(),
    taskId: z.string().trim().max(80).nullable(),
  })).max(40),
  cateringBasisGuests: z.number().int().min(1).max(5000).optional(),
  ideas: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().max(400),
    occasion: z.enum(OCCASIONS),
    estimatedCostInr: z.number().int().min(0).max(50_000_000),
    taskTitle: z.string().trim().max(140).nullable(),
    status: z.enum(["suggested", "saved", "dismissed", "added"]),
    source: z.enum(["gemini", "local"]),
  })).max(24).optional(),
};

export const eventPlanSchema = eventBriefSchema.extend(planFields).superRefine((plan, context) => {
  const unique = (items: Array<{ id: string }>, path: string) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      context.addIssue({ code: "custom", message: "Identifiers must be unique.", path: [path] });
    }
  };
  unique(plan.timelineTasks, "timelineTasks");
  unique(plan.checklist, "checklist");
  unique(plan.guests, "guests");
  // Older saved plans used quote-1/quote-2 in each category. Those IDs are unambiguous within a category.
  unique(plan.quotes.map((quote) => ({ id: `${quote.category}:${quote.id}` })), "quotes");
  unique(plan.ideas ?? [], "ideas");
  const categories = new Set(plan.budgetBreakdown.map((line) => line.category));
  if (plan.budgetBreakdown.length !== CATEGORIES.length || categories.size !== CATEGORIES.length) {
    context.addIssue({ code: "custom", message: "Include each budget category exactly once.", path: ["budgetBreakdown"] });
  }
  const taskIds = new Set(plan.timelineTasks.map((task) => task.id));
  for (const [index, item] of plan.checklist.entries()) {
    if (item.taskId && !taskIds.has(item.taskId)) context.addIssue({ code: "custom", message: "Linked task does not exist.", path: ["checklist", index, "taskId"] });
  }
  for (const [index, task] of plan.timelineTasks.entries()) {
    if (task.dependencies.some((id) => id === task.id || !taskIds.has(id))) {
      context.addIssue({ code: "custom", message: "Dependencies must reference other existing tasks.", path: ["timelineTasks", index, "dependencies"] });
    }
  }
});

export const generateRequestSchema = z.object({ brief: eventBriefSchema });

export const reviseRequestSchema = z.object({
  plan: eventPlanSchema,
  instruction: z.string().trim().min(8).max(600),
  today: realDate.optional(),
  baseRevision: z.number().int().min(0).optional(),
});

export const tradeoffRequestSchema = z.object({
  plan: eventPlanSchema,
});

export const ideasRequestSchema = z.object({
  plan: eventPlanSchema,
});

export const timelineRequestSchema = z.object({
  plan: eventPlanSchema,
  eventDate: realDate,
  today: realDate.optional(),
});

export const vendorQuestionRequestSchema = z.object({
  category: categorySchema,
  mustHaves: z.string().trim().min(2).max(400),
  guestCoverage: z.number().int().min(1).max(5000),
  budgetCapInr: z.number().int().min(0).max(50_000_000),
  occasion: z.enum(OCCASIONS),
  city: z.string().trim().min(2).max(80),
});

export const vendorCompareRequestSchema = z.object({
  quotes: z.array(quoteSchema).min(2).max(8),
  headcount: z.number().int().min(0).max(5000),
  capInr: z.number().int().min(0).max(50_000_000),
  category: categorySchema,
  mustHaves: z.string().trim().min(2).max(400),
  occasion: z.enum(OCCASIONS),
  city: z.string().trim().min(2).max(80),
}).superRefine((value, context) => {
  if (value.quotes.some((quote) => quote.category !== value.category)) {
    context.addIssue({ code: "custom", message: "Every quotation must match the selected category.", path: ["quotes"] });
  }
});

export const geminiPlanDraftSchema = z.object({
  rationale: z.string().trim().min(1).max(800),
  budgetBreakdown: z.array(budgetLineSchema).length(CATEGORIES.length),
  timelineTasks: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    ownerHint: z.string().trim().max(80),
    durationDays: z.number().int().min(1).max(120),
    dependencies: z.array(z.string().trim().min(1).max(80)).max(12),
    priority: z.enum(["high", "medium", "low"]),
    note: z.string().max(400),
  })).min(3).max(12),
  tradeOffScenarios: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(400),
    protectedPriority: categorySchema,
    lines: z.array(budgetLineSchema).min(1).max(8),
  })).max(4),
  vendorBriefs: z.array(z.object({
    category: categorySchema,
    mustHaves: z.string().trim().max(400),
    questions: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  })).max(6),
  checklist: z.array(z.string().trim().min(1).max(160)).min(3).max(10),
});

export const geminiTradeoffDraftSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  scenarios: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(400),
    protectedPriority: categorySchema,
    lines: z.array(budgetLineSchema).min(1).max(8),
  })).min(1).max(3),
});

export const geminiVendorDraftSchema = z.object({
  questions: z.array(z.string().trim().min(1).max(240)).min(3).max(6),
  vendorComparisonMatrix: z.array(z.object({
    quoteId: z.string().trim().min(1).max(80).optional(),
    vendorName: z.string().trim().min(1).max(80),
    fitSummary: z.string().trim().max(300),
    hiddenChargeNotes: z.array(z.string().trim().max(160)).max(6),
    isEstimated: z.literal(true),
  })).max(8),
});

export const geminiTimelineDraftSchema = z.object({
  timelineTasks: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    note: z.string().max(400),
    priority: z.enum(["high", "medium", "low"]),
    dependencies: z.array(z.string()).max(12),
    durationDays: z.number().int().min(1).max(120),
  })).min(1).max(20),
});

export type EventBriefInput = z.infer<typeof eventBriefSchema>;
export type EventPlanInput = z.infer<typeof eventPlanSchema>;
export type GeminiPlanDraft = z.infer<typeof geminiPlanDraftSchema>;
export type GeminiTradeoffDraft = z.infer<typeof geminiTradeoffDraftSchema>;
export type GeminiVendorDraft = z.infer<typeof geminiVendorDraftSchema>;
export const constraintDeltaSchema = z.object({
  guestDelta: z.number().int().min(-5000).max(5000).default(0),
  absoluteGuestCount: z.number().int().min(1).max(5000).nullable().default(null),
  budgetDeltaInr: z.number().int().min(-50_000_000).max(50_000_000).default(0),
  absoluteBudgetInr: z.number().int().min(0).max(50_000_000).nullable().default(null),
  dayShift: z.number().int().min(-366).max(366).default(0),
  absoluteEventDate: z.string().nullable().default(null),
  ambiguous: z.string().max(300).nullable().default(null),
});

export const geminiIdeasSchema = z.object({
  ideas: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().max(400),
    estimatedCostInr: z.number().int().min(0).max(50_000_000),
    taskTitle: z.string().trim().max(140),
  })).min(1).max(8),
});

export type GeminiTimelineDraft = z.infer<typeof geminiTimelineDraftSchema>;
