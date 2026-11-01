import { isValidBudgetScenario } from "@/domain/budget";
import { sumAmounts } from "@/domain/money";
import { buildLocalPlan } from "@/domain/local-plan";
import { scheduleTasks } from "@/domain/timeline";
import { CATEGORIES, type BudgetLine, type Category, type ChecklistItem, type EventBrief, type EventPlan } from "@/domain/types";
import type { GeminiPlanDraft, GeminiTimelineDraft, GeminiTradeoffDraft } from "@/lib/schemas";

function scaleLines(lines: BudgetLine[], budgetInr: number): BudgetLine[] {
  const byCategory = new Map(lines.map((line) => [line.category, line]));
  const complete = CATEGORIES.map((category) => {
    const line = byCategory.get(category);
    return {
      category,
      amountInr: Math.max(0, Math.round(line?.amountInr ?? 0)),
      assumption: line?.assumption || "Gemini estimate. Not a confirmed vendor price.",
      isEstimated: true as const,
    };
  });
  const current = sumAmounts(complete);
  if (current <= 0) {
    return complete.map((line, index) => ({
      ...line,
      amountInr: index === 0 ? budgetInr : 0,
    }));
  }
  // Largest-remainder allocation keeps every category nonnegative and the total exact.
  const exact = complete.map((line) => (line.amountInr / current) * budgetInr);
  const scaled = complete.map((line, index) => ({
    ...line,
    amountInr: Math.floor(exact[index]),
  }));
  const remainder = budgetInr - sumAmounts(scaled);
  const order = exact.map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) scaled[order[index % order.length].index].amountInr += 1;
  return scaled;
}

export function planFromDraft(
  brief: EventBrief,
  draft: GeminiPlanDraft,
  options?: { id?: string; today?: string },
): EventPlan {
  const local = buildLocalPlan(brief, options);

  const budgetBreakdown = scaleLines(
    draft.budgetBreakdown.map((line) => ({ ...line, isEstimated: true })),
    brief.budgetInr,
  ).map((line) => ({ ...line, origin: "gemini" as const }));

  const timelineTasks = scheduleTasks(
    draft.timelineTasks.map((task) => ({
      id: task.id,
      title: task.title,
      ownerHint: task.ownerHint || "Hosts",
      durationDays: task.durationDays,
      dependencies: task.dependencies,
      priority: task.priority,
      note: task.note,
    })),
    brief.eventDate,
    options?.today ?? new Date().toISOString().slice(0, 10),
  );

  const questionsByCategory = new Map<Category, string[]>();
  const mustHavesByCategory = new Map<Category, string>();
  for (const briefItem of draft.vendorBriefs) {
    questionsByCategory.set(briefItem.category, briefItem.questions);
    mustHavesByCategory.set(briefItem.category, briefItem.mustHaves);
  }
  const planAmount = new Map(budgetBreakdown.map((line) => [line.category, line.amountInr]));

  return {
    ...local,
    rationale: draft.rationale,
    source: "gemini",
    budgetBreakdown,
    timelineTasks,
    tradeOffScenarios: draft.tradeOffScenarios.flatMap((scenario) => {
      const lines = scaleLines(
        scenario.lines.map((line) => ({ ...line, isEstimated: true })),
        brief.budgetInr,
      );
      const sameAsPlan = lines.every((line) => line.amountInr === planAmount.get(line.category));
      const top = brief.priorities[0] ?? "catering";
      if (sameAsPlan || !isValidBudgetScenario(budgetBreakdown, lines, brief.budgetInr, top)) return [];
      return [{ ...scenario, protectedPriority: top, lines }];
    }),
    vendorBriefs: local.vendorBriefs.map((item) => ({
      ...item,
      guestCoverage: brief.guestCount,
      budgetCapInr: planAmount.get(item.category) ?? item.budgetCapInr,
      mustHaves: mustHavesByCategory.get(item.category) || item.mustHaves,
      questions: questionsByCategory.get(item.category) ?? item.questions,
    })),
    checklist: checklistFromDraft(draft.checklist, timelineTasks),
  };
}

export function checklistFromDraft(titles: string[], tasks: EventPlan["timelineTasks"]): ChecklistItem[] {
  const used = new Set<string>();
  return titles.map((title, index) => {
    const normalized = title.toLowerCase();
    const match = tasks.find((task) => {
      if (used.has(task.id)) return false;
      const taskTitle = task.title.toLowerCase();
      if (taskTitle === normalized || normalized.includes(taskTitle) || taskTitle.includes(normalized)) return true;
      const words = taskTitle.split(/[^a-z0-9]+/).filter((word) => word.length > 5);
      return words.filter((word) => normalized.includes(word)).length >= 2;
    });
    if (match) used.add(match.id);
    return {
      id: `check-${index + 1}`,
      title,
      done: false,
      taskId: match?.id ?? null,
    };
  });
}

export function applyTimelineDraft(plan: EventPlan, draft: GeminiTimelineDraft, eventDate: string, today: string): EventPlan {
  const notes = new Map(draft.timelineTasks.map((task) => [task.id, task.note]));
  const previous = new Map(plan.timelineTasks.map((task) => [task.id, task]));
  const timelineTasks = scheduleTasks(plan.timelineTasks, eventDate, today).map((task) => {
    const existing = previous.get(task.id);
    const done = existing?.status === "done";
    return {
      ...task,
      title: existing?.title ?? task.title,
      ownerHint: existing?.ownerHint ?? task.ownerHint,
      durationDays: existing?.durationDays ?? task.durationDays,
      dependencies: existing?.dependencies ?? task.dependencies,
      priority: existing?.priority ?? task.priority,
      status: done ? ("done" as const) : task.status,
      overdue: done ? false : task.overdue,
      note: notes.get(task.id) ?? existing?.note ?? task.note,
    };
  });
  return { ...plan, eventDate, timelineTasks };
}

export function applyTradeoffDraft(plan: EventPlan, draft: GeminiTradeoffDraft): EventPlan {
  const scenarios = draft.scenarios
    .map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      summary: scenario.summary || draft.summary,
      protectedPriority: plan.priorities[0] ?? "catering",
      lines: scenario.lines.map((line) => {
        const existing = plan.budgetBreakdown.find((item) => item.category === line.category);
        return existing && (!existing.isEstimated || existing.origin === "quote") && existing.amountInr === line.amountInr
          ? existing : { ...line, isEstimated: true, origin: "gemini" as const };
      }),
    }))
    .filter(
      (scenario) =>
        isValidBudgetScenario(plan.budgetBreakdown, scenario.lines, plan.budgetInr, scenario.protectedPriority),
    );
  return {
    ...plan,
    tradeOffScenarios: scenarios.length ? scenarios : plan.tradeOffScenarios,
  };
}
