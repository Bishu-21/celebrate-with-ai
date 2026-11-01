export const CATEGORIES = [
  "venue",
  "catering",
  "decor",
  "photography",
  "entertainment",
  "miscellaneous",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const OCCASIONS = ["wedding", "birthday", "community"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const VIBES = ["intimate", "grand"] as const;
export type Vibe = (typeof VIBES)[number];

export const TASK_STATUSES = ["todo", "doing", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const GUEST_STATUSES = ["invited", "yes", "no", "maybe"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export type PlanSource = "gemini" | "local";

export type LineOrigin = "local" | "gemini" | "quote" | "manual";

export type BudgetLine = {
  category: Category;
  amountInr: number;
  assumption: string;
  isEstimated: boolean;
  origin?: LineOrigin;
  selectedQuoteId?: string | null;
};

export type TimelineTask = {
  id: string;
  title: string;
  ownerHint: string;
  durationDays: number;
  dependencies: string[];
  priority: "high" | "medium" | "low";
  status: TaskStatus;
  dueDate: string;
  overdue: boolean;
  note: string;
};

export type TradeOffScenario = {
  id: string;
  title: string;
  summary: string;
  lines: BudgetLine[];
  protectedPriority: Category;
};

export type VendorBrief = {
  id: string;
  category: Category;
  mustHaves: string;
  guestCoverage: number;
  budgetCapInr: number;
  questions: string[];
};

export type VendorQuote = {
  id: string;
  vendorName: string;
  category: Category;
  amountInr: number;
  guestCoverage: number;
  included: string[];
  notes: string;
  isEstimated: boolean;
};

export type VendorComparisonRow = {
  quoteId: string;
  vendorName: string;
  category: Category;
  amountInr: number;
  guestCoverage: number;
  coversHeadcount: boolean;
  withinCap: boolean;
  hiddenChargeNotes: string[];
  included: string[];
  isEstimated: boolean;
  fitSummary?: string;
};

export type Guest = {
  id: string;
  name: string;
  email: string;
  partySize: number;
  status: GuestStatus;
  mealNote: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  taskId: string | null;
};

export type PersonalizedIdea = {
  id: string;
  title: string;
  summary: string;
  occasion: Occasion;
  estimatedCostInr: number;
  taskTitle: string | null;
  status: "suggested" | "saved" | "dismissed" | "added";
  source: PlanSource;
};

export type EventBrief = {
  occasion: Occasion;
  title: string;
  city: string;
  eventDate: string;
  guestCount: number;
  budgetInr: number;
  vibe: Vibe;
  priorities: Category[];
  notes: string;
};

export type EventPlan = EventBrief & {
  id: string;
  rationale: string;
  source: PlanSource;
  budgetBreakdown: BudgetLine[];
  timelineTasks: TimelineTask[];
  tradeOffScenarios: TradeOffScenario[];
  vendorBriefs: VendorBrief[];
  quotes: VendorQuote[];
  guests: Guest[];
  checklist: ChecklistItem[];
  ideas?: PersonalizedIdea[];
  cateringBasisGuests?: number;
};

export type ConstraintDelta = {
  guestDelta: number;
  budgetDeltaInr: number;
  dayShift: number;
  absoluteGuestCount?: number;
  absoluteBudgetInr?: number;
  absoluteEventDate?: string;
  ambiguous?: string;
};

export const CATEGORY_LABELS: Record<Category, string> = {
  venue: "Venue",
  catering: "Food",
  decor: "Decor",
  photography: "Photography",
  entertainment: "Entertainment",
  miscellaneous: "Miscellaneous",
};
