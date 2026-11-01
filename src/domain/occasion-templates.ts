import type { Occasion } from "@/domain/types";

export type OccasionTemplate = {
  id: string;
  occasion: Occasion;
  title: string;
  summary: string;
  estimatedCostInr: number;
  taskTitle: string | null;
  minBudgetInr?: number;
  maxBudgetInr?: number;
};

export const OCCASION_TEMPLATES: OccasionTemplate[] = [
  {
    id: "wedding-mandap",
    occasion: "wedding",
    title: "Walk the mandap before the deposit",
    summary: "Measure the aisle and the seating the decorator named. This is a planning step, not a booked vendor.",
    estimatedCostInr: 0,
    taskTitle: "Walk the mandap layout on site",
    minBudgetInr: 200_000,
  },
  {
    id: "wedding-mehendi",
    occasion: "wedding",
    title: "Keep mehendi the day before",
    summary: "A separate afternoon for close family, with a smaller catering assumption than the wedding day.",
    estimatedCostInr: 25_000,
    taskTitle: "Hold an hour for mehendi seating",
    minBudgetInr: 150_000,
  },
  {
    id: "wedding-home",
    occasion: "wedding",
    title: "Home ceremony checklist",
    summary: "For a smaller wedding budget: seating, one meal, and a photographer hour. No destination or multi-day vendor list.",
    estimatedCostInr: 8_000,
    taskTitle: "List what the home can hold",
    maxBudgetInr: 200_000,
  },
  {
    id: "birthday-cake",
    occasion: "birthday",
    title: "Cake that matches the headcount",
    summary: "Pick a cake size from the guest count. The price stays an estimate until a baker confirms it.",
    estimatedCostInr: 2_500,
    taskTitle: "Ask a baker for a cake that serves the guest count",
  },
  {
    id: "birthday-playlist",
    occasion: "birthday",
    title: "Shared playlist instead of a DJ",
    summary: "A low-budget birthday can use a speaker the host already has. This does not book entertainment.",
    estimatedCostInr: 0,
    taskTitle: null,
    maxBudgetInr: 80_000,
  },
  {
    id: "birthday-corner",
    occasion: "birthday",
    title: "One photo corner",
    summary: "A cloth, a light, and a friend with a phone. Skip a wedding-style photo team.",
    estimatedCostInr: 1_500,
    taskTitle: "Set up one photo corner",
    maxBudgetInr: 150_000,
  },
  {
    id: "community-roles",
    occasion: "community",
    title: "Name three volunteer roles",
    summary: "Welcome, seating, and closing. Community events run on people, not a wedding vendor stack.",
    estimatedCostInr: 0,
    taskTitle: "Assign welcome, seating, and closing",
  },
  {
    id: "community-access",
    occasion: "community",
    title: "Mark step-free seats",
    summary: "Reserve the front row for guests who asked for step-free access. No rental is assumed.",
    estimatedCostInr: 0,
    taskTitle: "Mark step-free seats on the room plan",
  },
];

export function templatesFor(occasion: Occasion, budgetInr: number): OccasionTemplate[] {
  return OCCASION_TEMPLATES.filter((template) => {
    if (template.occasion !== occasion) return false;
    if (template.minBudgetInr !== undefined && budgetInr < template.minBudgetInr) return false;
    if (template.maxBudgetInr !== undefined && budgetInr > template.maxBudgetInr) return false;
    return true;
  });
}
