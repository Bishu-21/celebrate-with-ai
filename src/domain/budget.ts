import { formatCount, sumAmounts } from "@/domain/money";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type BudgetLine,
  type Category,
  type TradeOffScenario,
  type Vibe,
} from "@/domain/types";

const BASE_SHARES: Record<Vibe, Record<Category, number>> = {
  intimate: {
    venue: 0.28,
    catering: 0.34,
    decor: 0.1,
    photography: 0.12,
    entertainment: 0.08,
    miscellaneous: 0.08,
  },
  grand: {
    venue: 0.32,
    catering: 0.3,
    decor: 0.14,
    photography: 0.1,
    entertainment: 0.08,
    miscellaneous: 0.06,
  },
};

const FLOOR_SHARE = 0.03;

function assumptionFor(category: Category, vibe: Vibe): string {
  const scale = vibe === "grand" ? "a larger guest experience" : "a smaller gathering";
  return `Planning assumption for ${CATEGORY_LABELS[category].toLowerCase()} at ${scale}. Not a confirmed vendor price.`;
}

function withRemainder(lines: BudgetLine[], budgetInr: number, preferred: Category): BudgetLine[] {
  const drift = budgetInr - sumAmounts(lines);
  if (drift === 0) return lines;
  return lines.map((line) => {
    if (line.category !== preferred) return line;
    const next = line.amountInr + drift;
    if (next < 0) return line;
    return { ...line, amountInr: next };
  });
}

function isLocked(line: BudgetLine): boolean {
  return line.isEstimated === false || line.origin === "quote";
}

export function allocateBudget(budgetInr: number, vibe: Vibe, priorities: Category[]): BudgetLine[] {
  const shares: Record<Category, number> = { ...BASE_SHARES[vibe] };
  const top = priorities[0] ?? "catering";
  const bottom = priorities[priorities.length - 1] ?? "miscellaneous";
  if (top !== bottom) {
    const shift = Math.min(shares[bottom] * 0.35, 0.06);
    shares[bottom] -= shift;
    shares[top] += shift;
  }

  const lines: BudgetLine[] = CATEGORIES.map((category) => ({
    category,
    amountInr: Math.round(budgetInr * shares[category]),
    assumption: assumptionFor(category, vibe),
    isEstimated: true,
  }));

  return withRemainder(lines, budgetInr, "miscellaneous");
}

export function perGuestAmount(line: BudgetLine, guestCount: number): number {
  if (guestCount <= 0) return 0;
  return Math.round(line.amountInr / guestCount);
}

export function scaleCateringForGuests(
  lines: BudgetLine[],
  previousGuests: number,
  nextGuests: number,
): BudgetLine[] {
  const safeNext = Math.max(1, nextGuests);
  const safePrevious = Math.max(1, previousGuests);
  return lines.map((line) => {
    if (line.category !== "catering" || isLocked(line)) return line;
    const perGuest = line.amountInr / safePrevious;
    return {
      ...line,
      amountInr: Math.max(0, Math.round(perGuest * safeNext)),
      assumption: `Scaled from about ${formatCount(perGuest)} per guest. This is an assumption, not a caterer's quote.`,
      isEstimated: true,
      origin: line.origin ?? "local",
    };
  });
}

export function projectSpend(lines: BudgetLine[]): number {
  return sumAmounts(lines);
}

export function overageInr(lines: BudgetLine[], budgetInr: number): number {
  return Math.max(0, projectSpend(lines) - budgetInr);
}

function floorFor(category: Category, budgetInr: number): number {
  return Math.round(budgetInr * FLOOR_SHARE * (category === "miscellaneous" ? 0.5 : 1));
}

export function cutByCategory(before: BudgetLine[], after: BudgetLine[]): Record<Category, number> {
  const beforeAmount = new Map(before.map((line) => [line.category, line.amountInr]));
  const afterAmount = new Map(after.map((line) => [line.category, line.amountInr]));
  return CATEGORIES.reduce(
    (cuts, category) => {
      cuts[category] = (beforeAmount.get(category) ?? 0) - (afterAmount.get(category) ?? 0);
      return cuts;
    },
    {} as Record<Category, number>,
  );
}

export function protectsTopPriority(before: BudgetLine[], after: BudgetLine[], top: Category): boolean {
  const cuts = cutByCategory(before, after);
  const topCut = Math.max(0, cuts[top]);
  const deepestOther = Math.max(0, ...CATEGORIES.filter((category) => category !== top).map((category) => cuts[category]));
  return topCut === 0 || topCut < deepestOther;
}

export function proposeTradeoffs(
  lines: BudgetLine[],
  budgetInr: number,
  priorities: Category[],
): TradeOffScenario[] {
  const excess = overageInr(lines, budgetInr);
  if (excess <= 0) return [];

  const top = priorities[0] ?? "catering";
  const lowestFirst = [...priorities].reverse().filter((category) => category !== top);
  const protective = lines.map((line) => ({ ...line, isEstimated: true }));
  let remaining = excess;

  for (const category of lowestFirst) {
    if (remaining <= 0) break;
    const line = protective.find((item) => item.category === category);
    if (!line) continue;
    const reducible = isLocked(line) ? 0 : Math.max(0, line.amountInr - floorFor(category, budgetInr));
    const cut = Math.min(reducible, remaining);
    line.amountInr -= cut;
    remaining -= cut;
    if (cut > 0) {
      line.assumption = `Reduced to protect ${CATEGORY_LABELS[top].toLowerCase()}. Assumption, not a confirmed quote.`;
    }
  }

  if (remaining > 0) {
    const topLine = protective.find((item) => item.category === top);
    if (topLine && !isLocked(topLine)) {
      const reducible = Math.max(0, topLine.amountInr - floorFor(top, budgetInr));
      const cut = Math.min(reducible, remaining);
      topLine.amountInr -= cut;
      if (cut > 0) {
        topLine.assumption = `Last-resort reduction after lower priorities hit their floor. Assumption, not a confirmed quote.`;
      }
    }
  }

  const balanced = withRemainder(protective, budgetInr, top);
  const even = lines.map((line) => ({ ...line, isEstimated: true }));
  const evenCutBase = excess / Math.max(1, CATEGORIES.length - 1);
  for (const line of even) {
    if (line.category === top || isLocked(line)) continue;
    const cut = Math.min(Math.max(0, line.amountInr - floorFor(line.category, budgetInr)), Math.round(evenCutBase));
    if (cut > 0) {
      line.amountInr -= cut;
      line.assumption = `Shared reduction that still protects ${CATEGORY_LABELS[top].toLowerCase()}. Assumption, not a confirmed quote.`;
    }
  }
  const evenBalanced = withRemainder(even, budgetInr, lowestFirst[0] ?? "miscellaneous");

  return [
    {
      id: "protect-top-priority",
      title: `Protect ${CATEGORY_LABELS[top].toLowerCase()}`,
      summary: `Closes ${formatCount(excess)} rupees of overage by cutting lower priorities first.`,
      lines: balanced,
      protectedPriority: top,
    },
    {
      id: "share-the-cut",
      title: "Share the cut",
      summary: `Spreads the overage across categories other than ${CATEGORY_LABELS[top].toLowerCase()}.`,
      lines: evenBalanced,
      protectedPriority: top,
    },
  ].filter((scenario) => protectsTopPriority(lines, scenario.lines, top) && sumAmounts(scenario.lines) === budgetInr);
}

export function applyConfirmedQuote(
  lines: BudgetLine[],
  category: Category,
  amountInr: number,
  vendorName: string,
  quoteId?: string,
): BudgetLine[] {
  return lines.map((line) =>
    line.category === category
      ? {
          ...line,
          amountInr: Math.max(0, Math.round(amountInr)),
          assumption: `Confirmed figure entered for ${vendorName}.`,
          isEstimated: false,
          origin: "quote",
          selectedQuoteId: quoteId ?? line.selectedQuoteId ?? null,
        }
      : line,
  );
}
