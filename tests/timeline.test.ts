import { describe, expect, it } from "vitest";
import { breakCycles, scheduleTasks, startDate, topologicalOrder, validateTaskGraph } from "@/domain/timeline";

const drafts = [
  { id: "lock-date-venue", title: "Lock venue", ownerHint: "Hosts", durationDays: 10, dependencies: [], priority: "high" as const },
  { id: "book-catering", title: "Book food", ownerHint: "Food", durationDays: 5, dependencies: ["lock-date-venue"], priority: "high" as const },
  { id: "confirm-menu", title: "Confirm menu", ownerHint: "Food", durationDays: 2, dependencies: ["book-catering"], priority: "medium" as const },
];

describe("timeline", () => {
  it("orders dependencies before the tasks that need them", () => {
    expect(topologicalOrder(drafts)).toEqual(["lock-date-venue", "book-catering", "confirm-menu"]);
  });

  it("finishes a dependency before the next task starts", () => {
    const tasks = scheduleTasks(drafts, "2026-12-20", "2026-11-01");
    const venue = tasks.find((task) => task.id === "lock-date-venue");
    const catering = tasks.find((task) => task.id === "book-catering");
    expect(venue?.dueDate).toBeTruthy();
    expect(catering?.dueDate).toBeTruthy();
    expect(venue!.dueDate < startDate(catering!)).toBe(true);
    expect(tasks.every((task) => task.dueDate <= "2026-12-20")).toBe(true);
  });

  it("moves the sequence when the event is 14 days earlier and keeps done work", () => {
    const original = scheduleTasks(drafts.map((task, index) => ({ ...task, status: index === 0 ? "done" as const : "todo" as const })), "2026-12-20", "2026-11-01");
    const shifted = scheduleTasks(original, "2026-12-06", "2026-11-01");
    const before = original.find((task) => task.id === "book-catering")?.dueDate;
    const after = shifted.find((task) => task.id === "book-catering")?.dueDate;
    expect(after! < before!).toBe(true);
    expect(shifted.find((task) => task.id === "lock-date-venue")?.status).toBe("done");
  });

  it("breaks a dependency cycle instead of throwing during scheduling", () => {
    const cyclic = breakCycles([
      { id: "a", title: "A", ownerHint: "Hosts", durationDays: 2, dependencies: ["b"], priority: "high" },
      { id: "b", title: "B", ownerHint: "Hosts", durationDays: 2, dependencies: ["a"], priority: "low" },
    ]);
    expect(() => topologicalOrder(cyclic)).not.toThrow();
    expect(topologicalOrder(cyclic)).toHaveLength(2);
  });

  it("reports a cycle instead of deleting the dependency", () => {
    const cyclic = [
      { id: "a", title: "A", ownerHint: "Hosts", durationDays: 2, dependencies: ["b"], priority: "high" as const },
      { id: "b", title: "B", ownerHint: "Hosts", durationDays: 2, dependencies: ["a"], priority: "low" as const },
    ];
    const scheduled = scheduleTasks(cyclic, "2026-12-20", "2026-11-01");
    expect(scheduled.find((task) => task.id === "a")?.dependencies).toEqual(["b"]);
    expect(validateTaskGraph(cyclic, "2026-12-20", "2026-11-01").join(" ")).toMatch(/cycle/i);
  });
});
