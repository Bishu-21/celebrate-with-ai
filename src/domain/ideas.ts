import { templatesFor } from "@/domain/occasion-templates";
import type { EventPlan, PersonalizedIdea } from "@/domain/types";

export function localIdeas(plan: Pick<EventPlan, "occasion" | "budgetInr">): PersonalizedIdea[] {
  return templatesFor(plan.occasion, plan.budgetInr).map((template) => ({
    id: template.id,
    title: template.title,
    summary: template.summary,
    occasion: template.occasion,
    estimatedCostInr: template.estimatedCostInr,
    taskTitle: template.taskTitle,
    status: "suggested" as const,
    source: "local" as const,
  }));
}
