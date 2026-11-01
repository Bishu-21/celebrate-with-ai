import { allocateBudget, proposeTradeoffs } from "@/domain/budget";
import { scheduleTasks, type TaskDraft } from "@/domain/timeline";
import { localVendorQuestions } from "@/domain/vendors";
import {
  type Category,
  type ChecklistItem,
  type EventBrief,
  type EventPlan,
  type VendorBrief,
} from "@/domain/types";

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && "randomUUID" in cryptoApi) return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const SHARED_TASKS: Array<Omit<TaskDraft, "dependencies"> & { dependencies: string[] }> = [
  {
    id: "lock-date-venue",
    title: "Lock the date and venue",
    ownerHint: "Hosts",
    durationDays: 10,
    dependencies: [],
    priority: "high",
    note: "Nothing else should be booked until the date and place are held.",
  },
  {
    id: "book-catering",
    title: "Book catering against the guest count",
    ownerHint: "Food lead",
    durationDays: 7,
    dependencies: ["lock-date-venue"],
    priority: "high",
    note: "Confirm per-guest assumptions before paying a deposit.",
  },
  {
    id: "book-decor",
    title: "Confirm decor scope",
    ownerHint: "Design lead",
    durationDays: 5,
    dependencies: ["lock-date-venue"],
    priority: "medium",
    note: "Decor can shrink if the budget tightens.",
  },
  {
    id: "book-photo",
    title: "Hold photography or coverage",
    ownerHint: "Hosts",
    durationDays: 4,
    dependencies: ["lock-date-venue"],
    priority: "medium",
    note: "Ask what is excluded before comparing quotes.",
  },
  {
    id: "book-entertainment",
    title: "Book entertainment",
    ownerHint: "Program lead",
    durationDays: 4,
    dependencies: ["lock-date-venue"],
    priority: "low",
    note: "Secondary to venue and food.",
  },
  {
    id: "send-invites",
    title: "Send invitations and collect RSVPs",
    ownerHint: "Hosts",
    durationDays: 14,
    dependencies: ["lock-date-venue"],
    priority: "high",
    note: "RSVP answers can scale catering later. The planning guest count stays on the overview.",
  },
  {
    id: "confirm-run-of-show",
    title: "Confirm the run of show",
    ownerHint: "Hosts",
    durationDays: 3,
    dependencies: ["book-catering", "book-photo"],
    priority: "medium",
    note: "Depends on food service and coverage being booked.",
  },
];

function tasksFor(occasion: EventBrief["occasion"]): Array<Omit<TaskDraft, "dependencies"> & { dependencies: string[] }> {
  return SHARED_TASKS.map((task) => {
    if (occasion === "birthday" && task.id === "book-catering") {
      return { ...task, title: "Order the cake and food", note: "Size the cake from the guest count. This is not a wedding menu." };
    }
    if (occasion === "birthday" && task.id === "book-photo") {
      return { ...task, title: "Ask someone to take photos", note: "A friend and a phone are enough unless the host asks for a photographer." };
    }
    if (occasion === "birthday" && task.id === "book-entertainment") {
      return { ...task, title: "Choose games or a playlist", note: "A short activity. Not a wedding band or a ceremony lineup." };
    }
    if (occasion === "birthday" && task.id === "book-decor") {
      return { ...task, title: "Set a simple backdrop", note: "One corner is enough. Skip a mandap or a stage." };
    }
    if (occasion === "community" && task.id === "book-catering") {
      return { ...task, title: "Plan tea or a shared meal", note: "Confirm a per-person assumption. This is not a wedding buffet." };
    }
    if (occasion === "community" && task.id === "book-entertainment") {
      return { ...task, title: "Assign volunteer roles", ownerHint: "Organisers", note: "Welcome, seating, and closing. Do not book a wedding entertainment act." };
    }
    if (occasion === "community" && task.id === "book-photo") {
      return { ...task, title: "Note who will photograph the gathering", note: "A volunteer can cover this unless the organisers collected a quote." };
    }
    if (occasion === "community" && task.id === "lock-date-venue") {
      return { ...task, title: "Reserve the room or ground", note: "Ask whether the venue needs a permission letter before announcing the date." };
    }
    if (occasion === "wedding" && task.id === "book-entertainment") {
      return { ...task, title: "Book ceremony music", note: "Music comes after the venue and date are held." };
    }
    return task;
  });
}

function vendorBriefs(brief: EventBrief, budgetLines: EventPlan["budgetBreakdown"]): VendorBrief[] {
  return (["venue", "catering", "decor", "photography", "entertainment"] as Category[]).map((category) => ({
    id: `brief-${category}`,
    category,
    mustHaves: brief.notes.trim() || `Suitable for a ${brief.vibe} ${brief.occasion} in ${brief.city}.`,
    guestCoverage: brief.guestCount,
    budgetCapInr: budgetLines.find((line) => line.category === category)?.amountInr ?? 0,
    questions: localVendorQuestions({
      category,
      mustHaves: brief.notes,
      guestCoverage: brief.guestCount,
      city: brief.city,
      occasion: brief.occasion,
    }),
  }));
}

function checklistFor(tasks: EventPlan["timelineTasks"]): ChecklistItem[] {
  return [
    ...tasks.slice(0, 4).map((task) => ({
      id: `check-${task.id}`,
      title: task.title,
      done: task.status === "done",
      taskId: task.id,
    })),
    {
      id: "check-access",
      title: "Note guest access needs and share them with the venue",
      done: false,
      taskId: "lock-date-venue",
    },
  ];
}

export function buildLocalPlan(brief: EventBrief, options?: { id?: string; today?: string }): EventPlan {
  const budgetBreakdown = allocateBudget(brief.budgetInr, brief.vibe, brief.priorities);
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  const timelineTasks = scheduleTasks(tasksFor(brief.occasion), brief.eventDate, today);
  return {
    ...brief,
    id: options?.id ?? createId("plan"),
    rationale:
      "Local estimate built from your intake. Category amounts, dates, and guest totals are calculated in the app. They are planning assumptions, not vendor quotes.",
    source: "local",
    budgetBreakdown,
    timelineTasks,
    tradeOffScenarios: proposeTradeoffs(budgetBreakdown, brief.budgetInr, brief.priorities),
    vendorBriefs: vendorBriefs(brief, budgetBreakdown),
    quotes: [],
    guests: [],
    checklist: checklistFor(timelineTasks),
  };
}


