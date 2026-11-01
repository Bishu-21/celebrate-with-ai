import { describe, expect, it } from "vitest";
import { applyTimelineDraft } from "@/domain/merge-draft";
import { buildLocalPlan } from "@/domain/local-plan";
import { FIXTURE_BRIEF } from "./brief";

describe("timeline merge", () => {
  it("keeps existing tasks and completed work when the model invents or drops ids", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-priya", today: "2026-11-01" });
    plan.timelineTasks = plan.timelineTasks.map((task) =>
      task.id === "lock-date-venue" ? { ...task, status: "done", overdue: false } : task,
    );
    const ids = plan.timelineTasks.map((task) => task.id);
    const merged = applyTimelineDraft(
      plan,
      {
        timelineTasks: [
          { id: "invented-task", title: "New task", note: "Ignore me", priority: "low", dependencies: [], durationDays: 1 },
          { id: "lock-date-venue", title: "Renamed", note: "Date moved. Keep the booking.", priority: "low", dependencies: ["book-catering"], durationDays: 99 },
        ],
      },
      "2026-12-06",
      "2026-11-01",
    );
    expect(merged.timelineTasks.map((task) => task.id)).toEqual(ids);
    const locked = merged.timelineTasks.find((task) => task.id === "lock-date-venue");
    expect(locked?.status).toBe("done");
    expect(locked?.title).toBe("Lock the date and venue");
    expect(locked?.note).toBe("Date moved. Keep the booking.");
    expect(merged.timelineTasks.some((task) => task.id === "invented-task")).toBe(false);
  });
});
