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

/** Regeneration may replace suggestions, but never the host's saved decisions. */
export function mergeIdeas(existing: PersonalizedIdea[], suggestions: PersonalizedIdea[]): PersonalizedIdea[] {
  const kept = existing.filter((idea) => idea.status !== "suggested");
  const ids = new Set(kept.map((idea) => idea.id));
  const titles = new Set(kept.map((idea) => idea.title.trim().toLowerCase()));
  for (const idea of suggestions) {
    const title = idea.title.trim().toLowerCase();
    if (ids.has(idea.id) || titles.has(title) || kept.length >= 24) continue;
    kept.push(idea);
    ids.add(idea.id);
    titles.add(title);
  }
  return kept;
}
