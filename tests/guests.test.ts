import { describe, expect, it } from "vitest";
import { headcount, isValidGuestEmail, isValidGuestName } from "@/domain/guests";
import type { Guest } from "@/domain/types";

const guests: Guest[] = [
  { id: "1", name: "Asha", email: "asha@example.com", partySize: 2, status: "yes", mealNote: "" },
  { id: "2", name: "Dev", email: "", partySize: 4, status: "maybe", mealNote: "Jain" },
  { id: "3", name: "Noor", email: "", partySize: 3, status: "no", mealNote: "" },
  { id: "4", name: "Ira", email: "", partySize: 1, status: "invited", mealNote: "" },
];

describe("guests", () => {
  it("counts yes and maybe party sizes and ignores declines", () => {
    expect(headcount(guests)).toBe(6);
  });

  it("rejects oversized names and broken emails", () => {
    expect(isValidGuestName("A")).toBe(false);
    expect(isValidGuestName("Asha")).toBe(true);
    expect(isValidGuestEmail("not-an-email")).toBe(false);
    expect(isValidGuestEmail("")).toBe(true);
  });
});
