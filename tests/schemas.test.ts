import { describe, expect, it } from "vitest";
import { FIXTURE_BRIEF } from "./brief";
import { eventBriefSchema, guestSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("accepts a complete intake", () => {
    expect(eventBriefSchema.safeParse(FIXTURE_BRIEF).success).toBe(true);
  });

  it("rejects an oversized note and a broken guest email", () => {
    const notes = "a".repeat(1001);
    expect(eventBriefSchema.safeParse({ ...FIXTURE_BRIEF, notes }).success).toBe(false);
    expect(guestSchema.safeParse({
      id: "g1",
      name: "Asha",
      email: "not-an-email",
      partySize: 2,
      status: "yes",
      mealNote: "",
    }).success).toBe(false);
  });
});
