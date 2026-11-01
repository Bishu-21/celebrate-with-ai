import { guestSummary } from "@/domain/guests";
import type { EventPlan } from "@/domain/types";

const MAX_CONTEXT_CHARS = 24_000;

export function buildAiContext(plan: EventPlan): Record<string, unknown> {
  const rsvp = guestSummary(plan.guests);
  const context = {
    planId: plan.id,
    occasion: plan.occasion,
    title: plan.title,
    city: plan.city,
    eventDate: plan.eventDate,
    guestCount: plan.guestCount,
    budgetInr: plan.budgetInr,
    vibe: plan.vibe,
    priorities: plan.priorities,
    notes: plan.notes,
    budgetBreakdown: plan.budgetBreakdown.map((line) => ({
      category: line.category,
      amountInr: line.amountInr,
      isEstimated: line.isEstimated,
      assumption: line.assumption,
    })),
    timelineTasks: plan.timelineTasks.map((task) => ({
      id: task.id,
      title: task.title,
      durationDays: task.durationDays,
      dependencies: task.dependencies,
      priority: task.priority,
      status: task.status,
      note: task.note,
    })),
    vendorBriefs: plan.vendorBriefs.map((brief) => ({
      category: brief.category,
      mustHaves: brief.mustHaves,
      guestCoverage: brief.guestCoverage,
      budgetCapInr: brief.budgetCapInr,
    })),
    rsvp,
  };
  const serialized = JSON.stringify(context);
  if (serialized.length <= MAX_CONTEXT_CHARS) return context;
  return {
    ...context,
    notes: plan.notes.slice(0, 500),
    timelineTasks: plan.timelineTasks.slice(0, 12).map((task) => ({ id: task.id, title: task.title, status: task.status, dependencies: task.dependencies })),
    vendorBriefs: plan.vendorBriefs.slice(0, 4).map((brief) => ({ category: brief.category, budgetCapInr: brief.budgetCapInr })),
  };
}
