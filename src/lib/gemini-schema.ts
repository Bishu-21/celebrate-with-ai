import { Type, type Schema } from "@google/genai";
import { CATEGORIES } from "@/domain/types";

const CATEGORY_ENUM = [...CATEGORIES];
export const CATEGORY_LIST = CATEGORY_ENUM.join(", ");
const PRIORITY_ENUM = ["high", "medium", "low"] as const;

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

export const TRADEOFF_RESPONSE_SCHEMA: Schema = {
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

export const VENDOR_RESPONSE_SCHEMA: Schema = {
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

export const TIMELINE_RESPONSE_SCHEMA: Schema = {
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

export const CONSTRAINT_DELTA_RESPONSE_SCHEMA: Schema = {
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
};

export const IDEAS_RESPONSE_SCHEMA: Schema = {
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
};

export const ESTIMATE_RULE =
  "Every cost is an assumption. Set isEstimated to true. Never present a number as a confirmed vendor price or as live availability.";
