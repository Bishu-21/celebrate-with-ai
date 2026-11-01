import { guestSummary } from "@/domain/guests";
import type { EventPlan } from "@/domain/types";

export type AiOperation = "tradeoffs" | "timeline" | "ideas";

export function buildAiContext(plan: EventPlan, operation: AiOperation = "ideas"): Record<string, unknown> {
  const context: Record<string, unknown> = {
    occasion: plan.occasion,
    city: plan.city,
    eventDate: plan.eventDate,
    guestCount: plan.guestCount,
    budgetInr: plan.budgetInr,
    vibe: plan.vibe,
    priorities: plan.priorities,
    notes: plan.notes,
  };
  if (operation === "tradeoffs") {
    context.budgetBreakdown = plan.budgetBreakdown.map((line) => ({
      category: line.category,
      amountInr: line.amountInr,
      isEstimated: line.isEstimated,
    }));
  } else if (operation === "timeline") {
    context.timelineTasks = plan.timelineTasks.map((task) => ({
      id: task.id,
      title: task.title,
      durationDays: task.durationDays,
      dependencies: task.dependencies,
      priority: task.priority,
      status: task.status,
    }));
  } else {
    context.rsvp = guestSummary(plan.guests);
    context.existingIdeas = (plan.ideas ?? []).map(({ title, status }) => ({ title, status }));
  }
  // Bound context without losing identities or cutting a serialized JSON string.
  if (JSON.stringify(context).length > 64_000) throw new Error("The planning context is too large. Shorten task descriptions before trying again.");
  return context;
}
