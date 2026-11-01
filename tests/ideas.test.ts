import { describe, expect, it } from "vitest";
import { localIdeas, mergeIdeas } from "@/domain/ideas";
import { buildLocalPlan } from "@/domain/local-plan";
import { FIXTURE_BRIEF } from "./brief";

describe("occasion ideas", () => {
  it("preserves saved, dismissed, and added choices when suggestions are regenerated", () => {
    const suggested = localIdeas({ occasion: "birthday", budgetInr: 40000 });
    const existing = suggested.map((idea, i) => ({ ...idea, status: (["added", "saved", "dismissed"] as const)[i] }));
    expect(mergeIdeas(existing, suggested)).toEqual(existing);
  });
  it("keeps a low-budget birthday away from wedding rituals", () => {
    const ideas = localIdeas({ occasion: "birthday", budgetInr: 40_000 });
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((idea) => idea.occasion === "birthday" && idea.source === "local")).toBe(true);
    expect(ideas.some((idea) => /mandap|mehendi|baraat/i.test(idea.title + idea.summary))).toBe(false);
  });

  it("uses different tasks for a birthday and a community gathering", () => {
    const birthday = buildLocalPlan({ ...FIXTURE_BRIEF, occasion: "birthday", budgetInr: 40_000 }, { today: "2026-11-01" });
    const community = buildLocalPlan({ ...FIXTURE_BRIEF, occasion: "community" }, { today: "2026-11-01" });
    const wedding = buildLocalPlan(FIXTURE_BRIEF, { today: "2026-11-01" });
    expect(birthday.timelineTasks.map((task) => task.title).join(" ")).toMatch(/cake/i);
    expect(birthday.timelineTasks.map((task) => task.title).join(" ")).not.toMatch(/ceremony music/i);
    expect(community.timelineTasks.map((task) => task.title).join(" ")).toMatch(/volunteer/i);
    expect(wedding.timelineTasks.map((task) => task.title).join(" ")).toMatch(/ceremony music/i);
  });

  it("uses different templates for a community gathering", () => {
    const ideas = localIdeas({ occasion: "community", budgetInr: 80_000 });
    expect(ideas.some((idea) => /volunteer/i.test(idea.title))).toBe(true);
    expect(ideas.some((idea) => idea.occasion === "wedding")).toBe(false);
  });
});
