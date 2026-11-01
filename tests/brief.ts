import type { EventBrief } from "@/domain/types";

export const FIXTURE_BRIEF: EventBrief = {
  occasion: "wedding",
  title: "Priya & Arjun",
  city: "Jaipur",
  eventDate: "2026-12-20",
  guestCount: 120,
  budgetInr: 1_500_000,
  vibe: "grand",
  priorities: ["catering", "venue", "photography", "decor", "entertainment", "miscellaneous"],
  notes: "Vegetarian and Jain meals. Step-free access for two grandparents. Indoor backup if it rains.",
};
