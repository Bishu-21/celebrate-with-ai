import { overageInr, proposeTradeoffs, scaleCateringForGuests } from "@/domain/budget";
import { addDays, isRealIsoDate } from "@/domain/money";
import { scheduleTasks } from "@/domain/timeline";
import { synchronizeVendorCaps } from "@/domain/vendors";
import type { ConstraintDelta, EventPlan } from "@/domain/types";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function inrFromWords(amount: number, unit: string | undefined): number {
  const scale = unit?.toLowerCase() ?? "";
  if (scale.startsWith("lakh") || scale.startsWith("lac")) return Math.round(amount * 100_000);
  if (scale.startsWith("crore")) return Math.round(amount * 10_000_000);
  return Math.round(amount);
}

function dateInMonth(eventDate: string, monthName: string): string | undefined {
  if (!isRealIsoDate(eventDate)) return undefined;
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return undefined;
  const year = Number(eventDate.slice(0, 4));
  const day = Number(eventDate.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

const GUEST_MORE = /(\d+)\s+more\s+(?:guests|people|persons|folks)/i;
const GUEST_INVITING = /inviting\s+(\d+)\s+more/i;
const GUEST_ADD = /add\s+(\d+)\s+(?:guests|people|persons)/i;
const GUEST_FEWER = /(\d+)\s+fewer\s+(?:guests|people|persons)/i;
const GUEST_REMOVE = /remove\s+(\d+)\s+(?:guests|people)/i;
const GUEST_ABSOLUTE = /(?:guests?|headcount|people)\s+(?:is|are)\s+now\s+(\d+)/i;
const BUDGET_PERCENT_DOWN = /budget\s+(?:dropped|reduced|cut|down)\s+by\s+(\d+(?:\.\d+)?)\s*%/i;
const BUDGET_PERCENT_UP = /budget\s+(?:increased|raised|up)\s+by\s+(\d+(?:\.\d+)?)\s*%/i;
const BUDGET_MONEY = /budget\s+(dropped|reduced|cut|down|increased|raised|up)\s+by\s+[^0-9]*([0-9][0-9,]*(?:\.\d+)?)(?:\s*(lakh|lac|crore))?/i;
const BUDGET_ABSOLUTE = /budget\s+(?:is\s+now|(?:has\s+been\s+|is\s+)?(?:increased|raised|dropped|reduced|cut|changed)\s+to)\s+[^0-9]*([0-9][0-9,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?)?/i;
const WEEKS_EARLIER = /(\d+)\s+weeks?\s+earlier/i;
const DAYS_EARLIER = /(\d+)\s+days?\s+earlier/i;
const WEEKS_LATER = /(\d+)\s+weeks?\s+later/i;
const DAYS_LATER = /(\d+)\s+days?\s+later/i;
const DATED = /(?:event|date|party)\s+(?:is|on|moves to)\s+(\d{4}-\d{2}-\d{2})/i;
const MONTH_NAMED = /(?:move|moving|reschedule|shift|party|event|date)\s+(?:the\s+)?(?:party|event|date)?\s*(?:to|in)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i;

export function parseConstraintChange(text: string, currentBudgetInr: number, eventDate = ""): ConstraintDelta {
  const guestMore = GUEST_MORE.exec(text) ?? GUEST_INVITING.exec(text);
  const guestAdd = GUEST_ADD.exec(text);
  const guestFewer = GUEST_FEWER.exec(text) ?? GUEST_REMOVE.exec(text);
  const guestAbsolute = GUEST_ABSOLUTE.exec(text);
  const guestDelta = guestMore ? Number(guestMore[1]) : guestAdd ? Number(guestAdd[1]) : guestFewer ? -Number(guestFewer[1]) : 0;

  const percent = BUDGET_PERCENT_DOWN.exec(text);
  const raisedPercent = BUDGET_PERCENT_UP.exec(text);
  const money = BUDGET_MONEY.exec(text);
  const absoluteMoney = BUDGET_ABSOLUTE.exec(text);

  let budgetDeltaInr = 0;
  let sawBudgetDelta = false;
  if (percent) {
    budgetDeltaInr = -Math.round(currentBudgetInr * (Number(percent[1]) / 100));
    sawBudgetDelta = true;
  } else if (raisedPercent) {
    budgetDeltaInr = Math.round(currentBudgetInr * (Number(raisedPercent[1]) / 100));
    sawBudgetDelta = true;
  } else if (money) {
    const amount = inrFromWords(Number(money[2].replace(/[^\d.]/g, "")), money[3]);
    const raised = /^(increased|raised|up)$/i.test(money[1]);
    budgetDeltaInr = (raised ? 1 : -1) * amount;
    sawBudgetDelta = true;
  }

  const absoluteBudgetInr = absoluteMoney ? inrFromWords(Number(absoluteMoney[1].replace(/[^\d.]/g, "")), absoluteMoney[2]) : undefined;

  const weeksEarlier = WEEKS_EARLIER.exec(text);
  const daysEarlier = DAYS_EARLIER.exec(text);
  const weeksLater = WEEKS_LATER.exec(text);
  const daysLater = DAYS_LATER.exec(text);
  const dated = DATED.exec(text);
  const monthNamed = MONTH_NAMED.exec(text);
  const monthDate = monthNamed ? dateInMonth(eventDate, monthNamed[1]) : undefined;
  const sawShift = Boolean(weeksEarlier || daysEarlier || weeksLater || daysLater || monthDate);
  const dayShift = weeksEarlier
    ? -7 * Number(weeksEarlier[1])
    : daysEarlier
      ? -Number(daysEarlier[1])
      : weeksLater
        ? 7 * Number(weeksLater[1])
        : daysLater
          ? Number(daysLater[1])
          : 0;

  const conflicts: string[] = [];
  if (guestAbsolute && guestDelta !== 0) conflicts.push("guest count is both a change and a new total");
  if (absoluteBudgetInr !== undefined && sawBudgetDelta) conflicts.push("budget is both a change and a new total");
  if (dated && sawShift) conflicts.push("the date is both a shift and a calendar day");
  if (monthDate && (weeksEarlier || daysEarlier || weeksLater || daysLater)) conflicts.push("the date is both a month and a day count");
  if (dated && !isRealIsoDate(dated[1])) conflicts.push("the new date is not a real calendar day");

  const delta: ConstraintDelta = { guestDelta, budgetDeltaInr, dayShift };
  if (guestAbsolute && guestDelta === 0) delta.absoluteGuestCount = Number(guestAbsolute[1]);
  if (absoluteBudgetInr !== undefined && !sawBudgetDelta) delta.absoluteBudgetInr = absoluteBudgetInr;
  if (dated && !monthDate && !weeksEarlier && !daysEarlier && !weeksLater && !daysLater && isRealIsoDate(dated[1])) delta.absoluteEventDate = dated[1];
  else if (monthDate && !dated && !weeksEarlier && !daysEarlier && !weeksLater && !daysLater) delta.absoluteEventDate = monthDate;
  if (conflicts.length) delta.ambiguous = `This note is ambiguous because the ${conflicts.join(" and the ")}.`;
  return delta;
}

export function constraintDeltaIsSettled(delta: ConstraintDelta): boolean {
  if (delta.ambiguous) return false;
  return Boolean(
    delta.guestDelta ||
      delta.absoluteGuestCount ||
      delta.budgetDeltaInr ||
      delta.absoluteBudgetInr !== undefined ||
      delta.dayShift ||
      delta.absoluteEventDate,
  );
}

export function advisoryScope(
  before: Pick<EventPlan, "budgetInr" | "guestCount" | "eventDate">,
  after: Pick<EventPlan, "budgetInr" | "guestCount" | "eventDate">,
): { tradeoffs: boolean; timeline: boolean } {
  return {
    tradeoffs: before.budgetInr !== after.budgetInr || before.guestCount !== after.guestCount,
    timeline: before.eventDate !== after.eventDate,
  };
}

export function mergeConstraintDelta(parsed: ConstraintDelta, extracted: ConstraintDelta | null): ConstraintDelta {
  if (!extracted) return parsed;
  const parsedHasChange = Boolean(
    parsed.guestDelta || parsed.absoluteGuestCount || parsed.budgetDeltaInr || parsed.absoluteBudgetInr || parsed.dayShift || parsed.absoluteEventDate,
  );
  if (extracted.ambiguous && !parsedHasChange) return extracted;
  if (parsed.ambiguous) return parsed;
  const next: ConstraintDelta = { ...parsed };
  if (!next.guestDelta && !next.absoluteGuestCount) {
    if (extracted.absoluteGuestCount) next.absoluteGuestCount = extracted.absoluteGuestCount;
    else if (extracted.guestDelta) next.guestDelta = extracted.guestDelta;
  }
  if (!next.budgetDeltaInr && next.absoluteBudgetInr === undefined) {
    if (extracted.absoluteBudgetInr !== undefined) next.absoluteBudgetInr = extracted.absoluteBudgetInr;
    else if (extracted.budgetDeltaInr) next.budgetDeltaInr = extracted.budgetDeltaInr;
  }
  if (!next.dayShift && !next.absoluteEventDate) {
    if (extracted.absoluteEventDate && isRealIsoDate(extracted.absoluteEventDate)) next.absoluteEventDate = extracted.absoluteEventDate;
    else if (extracted.dayShift) next.dayShift = extracted.dayShift;
  }
  return next;
}

export function revisePlan(
  plan: EventPlan,
  delta: ConstraintDelta,
  today: string,
): { plan: EventPlan; changes: string[]; warning: string | null } {
  if (delta.ambiguous) {
    return { plan, changes: [], warning: delta.ambiguous };
  }
  if (!isRealIsoDate(today) || !isRealIsoDate(plan.eventDate)) {
    return { plan, changes: [], warning: "The event date needs to be a real calendar day before it can move." };
  }

  const nextGuestCount = delta.absoluteGuestCount ?? plan.guestCount + delta.guestDelta;
  const nextBudget = delta.absoluteBudgetInr ?? plan.budgetInr + delta.budgetDeltaInr;
  if (!Number.isSafeInteger(nextGuestCount) || nextGuestCount < 1 || nextGuestCount > 5000 || !Number.isSafeInteger(nextBudget) || nextBudget < 10_000 || nextBudget > 50_000_000) {
    return { plan, changes: [], warning: "Use a guest count from 1 to 5,000 and a budget from ₹10,000 to ₹5,00,00,000. No changes were applied." };
  }
  const nextDate = delta.absoluteEventDate ?? addDays(plan.eventDate, delta.dayShift);
  if (!isRealIsoDate(nextDate)) return { plan, changes: [], warning: "Choose a real event date. No changes were applied." };
  const guestsChanged = nextGuestCount !== plan.guestCount;
  const lines = guestsChanged ? scaleCateringForGuests(plan.budgetBreakdown, plan.cateringBasisGuests ?? plan.guestCount, nextGuestCount) : plan.budgetBreakdown;
  const scenarios = proposeTradeoffs(lines, nextBudget, plan.priorities);
  const over = overageInr(lines, nextBudget);

  const changes = [
    nextGuestCount === plan.guestCount ? "" : `Guest count ${plan.guestCount} → ${nextGuestCount}.`,
    nextBudget === plan.budgetInr ? "" : `Budget ${plan.budgetInr} → ${nextBudget}.`,
    nextDate === plan.eventDate ? "" : `Event date ${plan.eventDate} → ${nextDate}.`,
    over > 0 ? `Projected spend is ${over} rupees over the new budget. No cut was applied.` : "",
  ].filter(Boolean);

  const timelineTasks = scheduleTasks(
    plan.timelineTasks.map((task) => ({
      id: task.id,
      title: task.title,
      ownerHint: task.ownerHint,
      durationDays: task.durationDays,
      dependencies: task.dependencies,
      priority: task.priority,
      status: task.status,
      note: task.note,
    })),
    nextDate,
    today,
  );
  const doneIds = new Set(plan.timelineTasks.filter((task) => task.status === "done").map((task) => task.id));
  for (const task of timelineTasks) {
    if (doneIds.has(task.id)) {
      task.status = "done";
      task.overdue = false;
    }
  }

  return {
    changes,
    warning: over > 0 ? "Choose a trade-off before the plan fits the new budget. Confirmed quotes were left as entered." : null,
    plan: synchronizeVendorCaps({
      ...plan,
      guestCount: nextGuestCount,
      cateringBasisGuests: guestsChanged ? nextGuestCount : plan.cateringBasisGuests,
      budgetInr: nextBudget,
      eventDate: nextDate,
      budgetBreakdown: lines,
      timelineTasks,
      tradeOffScenarios: scenarios,
      vendorBriefs: plan.vendorBriefs.map((brief) => ({ ...brief, guestCoverage: nextGuestCount })),
    }),
  };
}
