import { beforeEach, describe, expect, it } from "vitest";
import { buildLocalPlan } from "@/domain/local-plan";
import { clearPlan, getPlanRevision, getStorageIssue, refreshPlanFromStorage, savePlan } from "@/lib/storage";
import { FIXTURE_BRIEF } from "./brief";

describe("plan storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPlan();
  });

  it("migrates a readable v1 plan into a v2 envelope", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-stored", today: "2026-11-01" });
    window.localStorage.setItem("marigold.plan.v1", JSON.stringify(plan));
    const loaded = refreshPlanFromStorage();
    expect(loaded?.id).toBe("plan-stored");
    expect(getPlanRevision()).toBe(1);
    expect(window.localStorage.getItem("marigold.plan.v2")).toContain("\"schemaVersion\":2");
    expect(window.localStorage.getItem("marigold.plan.v1")).toContain("plan-stored");
  });

  it("quarantines corrupt JSON and leaves the original in place", () => {
    window.localStorage.setItem("marigold.plan.v2", "{not-json");
    expect(refreshPlanFromStorage()).toBeNull();
    expect(getStorageIssue()).toMatch(/could not be read/i);
    expect(window.localStorage.getItem("marigold.plan.v2")).toBe("{not-json");
    expect(window.localStorage.getItem("marigold.plan.quarantine")).toBe("{not-json");
  });

  it("reports a quota failure without claiming the plan was stored", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-stored", today: "2026-11-01" });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    const saved = savePlan(plan, 0);
    Storage.prototype.setItem = setItem;
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.reason).toBe("quota");
    expect(window.localStorage.getItem("marigold.plan.v2")).toBeNull();
  });
});
