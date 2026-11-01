import { applyConfirmedQuote, overageInr, proposeTradeoffs, scaleCateringForGuests } from "@/domain/budget";
import { isRealIsoDate } from "@/domain/money";
import { scheduleTasks } from "@/domain/timeline";
import type { Category, EventPlan, Guest, PersonalizedIdea, TaskStatus } from "@/domain/types";

export type PlanCommand =
  | { type: "set-task-status"; taskId: string; status: TaskStatus; today: string }
  | { type: "set-checklist"; itemId: string; done: boolean }
  | { type: "upsert-guest"; guest: Guest }
  | { type: "remove-guest"; guestId: string }
  | { type: "apply-scenario"; scenarioId: string }
  | { type: "confirm-quote"; category: Category; amountInr: number; vendorName: string; quoteId?: string }
  | { type: "set-event-date"; eventDate: string; today: string }
  | { type: "apply-headcount"; guestCount: number; today: string }
  | { type: "set-idea-status"; ideaId: string; status: PersonalizedIdea["status"] }
  | { type: "add-idea"; ideaId: string; today: string };

export type CommandResult = { ok: true; plan: EventPlan; warning: string | null } | { ok: false; plan: EventPlan; error: string };

function reject(plan: EventPlan, error: string): CommandResult {
  return { ok: false, plan, error };
}

export function applyPlanCommand(plan: EventPlan, command: PlanCommand): CommandResult {
  if (command.type === "set-task-status") {
    const task = plan.timelineTasks.find((item) => item.id === command.taskId);
    if (!task) return reject(plan, "That task is not in this plan.");
    const timelineTasks = scheduleTasks(
      plan.timelineTasks.map((item) => (item.id === command.taskId ? { ...item, status: command.status } : item)),
      plan.eventDate,
      command.today,
    );
    const checklist = plan.checklist.map((item) =>
      item.taskId === command.taskId ? { ...item, done: command.status === "done" } : item,
    );
    return { ok: true, warning: null, plan: { ...plan, timelineTasks, checklist } };
  }

  if (command.type === "set-checklist") {
    const target = plan.checklist.find((item) => item.id === command.itemId);
    if (!target) return reject(plan, "That checklist item is not in this plan.");
    const checklist = plan.checklist.map((item) => (item.id === command.itemId ? { ...item, done: command.done } : item));
    const timelineTasks = plan.timelineTasks.map((task) => {
      const linked = checklist.filter((item) => item.taskId === task.id);
      if (!linked.length || !linked.some((item) => item.id === command.itemId)) return task;
      const done = linked.every((item) => item.done);
      return { ...task, status: done ? "done" as const : task.status === "done" ? "todo" as const : task.status, overdue: done ? false : task.overdue };
    });
    return { ok: true, warning: null, plan: { ...plan, checklist, timelineTasks } };
  }

  if (command.type === "upsert-guest") {
    if (!Number.isInteger(command.guest.partySize) || command.guest.partySize < 1 || command.guest.partySize > 20) {
      return reject(plan, "Party size has to be a whole number from 1 to 20.");
    }
    const exists = plan.guests.some((guest) => guest.id === command.guest.id);
    const guests = exists
      ? plan.guests.map((guest) => (guest.id === command.guest.id ? command.guest : guest))
      : [...plan.guests, command.guest];
    return { ok: true, warning: null, plan: { ...plan, guests } };
  }

  if (command.type === "remove-guest") {
    return { ok: true, warning: null, plan: { ...plan, guests: plan.guests.filter((guest) => guest.id !== command.guestId) } };
  }

  if (command.type === "apply-scenario") {
    const scenario = plan.tradeOffScenarios.find((item) => item.id === command.scenarioId);
    if (!scenario) return reject(plan, "That trade-off is no longer on the plan.");
    const locked = new Map(plan.budgetBreakdown.filter((line) => line.isEstimated === false || line.origin === "quote").map((line) => [line.category, line]));
    const budgetBreakdown = scenario.lines.map((line) => locked.get(line.category) ?? line);
    const over = overageInr(budgetBreakdown, plan.budgetInr);
    return {
      ok: true,
      warning: over > 0 ? `Confirmed quotes stay in place, so the plan is still ${over} rupees over budget.` : null,
      plan: {
        ...plan,
        budgetBreakdown,
        tradeOffScenarios: proposeTradeoffs(budgetBreakdown, plan.budgetInr, plan.priorities),
      },
    };
  }

  if (command.type === "confirm-quote") {
    if (!Number.isInteger(command.amountInr) || command.amountInr < 0) return reject(plan, "Enter the quoted amount in whole rupees.");
    if (command.vendorName.trim().length < 2) return reject(plan, "Enter the vendor name from the quotation.");
    const budgetBreakdown = applyConfirmedQuote(plan.budgetBreakdown, command.category, command.amountInr, command.vendorName.trim(), command.quoteId);
    const over = overageInr(budgetBreakdown, plan.budgetInr);
    return {
      ok: true,
      warning: over > 0 ? `Confirmed costs are ${over} rupees over the budget. The quote was not reduced to make it fit.` : null,
      plan: {
        ...plan,
        budgetBreakdown,
        tradeOffScenarios: proposeTradeoffs(budgetBreakdown, plan.budgetInr, plan.priorities),
      },
    };
  }

  if (command.type === "set-event-date") {
    if (!isRealIsoDate(command.eventDate)) return reject(plan, "Choose a real calendar date.");
    const timelineTasks = scheduleTasks(plan.timelineTasks, command.eventDate, command.today);
    const doneIds = new Set(plan.timelineTasks.filter((task) => task.status === "done").map((task) => task.id));
    for (const task of timelineTasks) {
      if (doneIds.has(task.id)) {
        task.status = "done";
        task.overdue = false;
      }
    }
    return { ok: true, warning: null, plan: { ...plan, eventDate: command.eventDate, timelineTasks } };
  }

  if (command.type === "apply-headcount") {
    if (!Number.isInteger(command.guestCount) || command.guestCount < 1) return reject(plan, "RSVP headcount has to be at least 1.");
    const catering = plan.budgetBreakdown.find((line) => line.category === "catering");
    if (catering && (catering.isEstimated === false || catering.origin === "quote")) {
      return {
        ok: true,
        warning: `Catering is a confirmed quote, so the amount stayed. The planning guest count stays ${plan.guestCount}.`,
        plan: {
          ...plan,
          vendorBriefs: plan.vendorBriefs.map((brief) =>
            brief.category === "catering" ? { ...brief, guestCoverage: command.guestCount } : brief,
          ),
        },
      };
    }
    const basis = plan.cateringBasisGuests ?? plan.guestCount;
    const budgetBreakdown = scaleCateringForGuests(plan.budgetBreakdown, basis, command.guestCount);
    return {
      ok: true,
      warning: `Catering now follows ${command.guestCount} yes and maybe guests. The planning guest count stays ${plan.guestCount}.`,
      plan: {
        ...plan,
        cateringBasisGuests: command.guestCount,
        budgetBreakdown,
        tradeOffScenarios: proposeTradeoffs(budgetBreakdown, plan.budgetInr, plan.priorities),
        vendorBriefs: plan.vendorBriefs.map((brief) =>
          brief.category === "catering" ? { ...brief, guestCoverage: command.guestCount } : brief,
        ),
      },
    };
  }

  if (command.type === "set-idea-status") {
    const ideas = (plan.ideas ?? []).map((idea) => (idea.id === command.ideaId ? { ...idea, status: command.status } : idea));
    if (!ideas.some((idea) => idea.id === command.ideaId)) return reject(plan, "That idea is not on this plan.");
    return { ok: true, warning: null, plan: { ...plan, ideas } };
  }

  const idea = (plan.ideas ?? []).find((item) => item.id === command.ideaId);
  if (!idea) return reject(plan, "That idea is not on this plan.");
  const ideas = (plan.ideas ?? []).map((item) => (item.id === idea.id ? { ...item, status: "added" as const } : item));
  const taskId = `idea-${idea.id}`;
  const hasTask = plan.timelineTasks.some((task) => task.id === taskId);
  const timelineTasks = hasTask || !idea.taskTitle
    ? plan.timelineTasks
    : scheduleTasks(
        [
          ...plan.timelineTasks,
          {
            id: taskId,
            title: idea.taskTitle,
            ownerHint: "Hosts",
            durationDays: 1,
            dependencies: [],
            priority: "low" as const,
            status: "todo" as const,
            note: idea.summary,
          },
        ],
        plan.eventDate,
        command.today,
      );
  const miscellaneous = plan.budgetBreakdown.find((line) => line.category === "miscellaneous");
  const locked = miscellaneous ? miscellaneous.isEstimated === false || miscellaneous.origin === "quote" : false;
  const budgetBreakdown = plan.budgetBreakdown.map((line) =>
    line.category === "miscellaneous" && !locked
      ? {
          ...line,
          amountInr: line.amountInr + idea.estimatedCostInr,
          assumption: `${line.assumption} Includes ${idea.estimatedCostInr} rupees for “${idea.title}”, still an estimate.`,
          isEstimated: true,
        }
      : line,
  );
  const over = overageInr(budgetBreakdown, plan.budgetInr);
  return {
    ok: true,
    warning: locked
      ? "Miscellaneous is a confirmed quote, so the idea was added as a task without changing that amount."
      : over > 0
        ? `Adding this idea puts the plan ${over} rupees over budget.`
        : null,
    plan: { ...plan, ideas, timelineTasks, budgetBreakdown, tradeOffScenarios: proposeTradeoffs(budgetBreakdown, plan.budgetInr, plan.priorities) },
  };
}
