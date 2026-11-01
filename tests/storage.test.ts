import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalPlan } from "@/domain/local-plan";
import { clearPlan, getPlanRevision, getStorageIssue, refreshPlanFromStorage, savePlan } from "@/lib/storage";
import { FIXTURE_BRIEF } from "./brief";

describe("plan storage", () => {
  afterEach(() => vi.restoreAllMocks());
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

  it("rejects a save when the stored revision moved", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-stored", today: "2026-11-01" });
    const first = savePlan(plan, 0);
    expect(first.ok).toBe(true);
    const stale = savePlan({ ...plan, city: "Pune" }, 0);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.reason).toBe("conflict");
    const next = savePlan({ ...plan, city: "Pune" }, getPlanRevision());
    expect(next.ok).toBe(true);
    expect(getPlanRevision()).toBe(2);
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

  it("does not throw when browser reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => refreshPlanFromStorage()).not.toThrow();
    expect(getStorageIssue()).toMatch(/browser|storage/i);
  });

  it("validates a plan before overwriting a durable copy", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    savePlan(plan, 0);
    const before = window.localStorage.getItem("marigold.plan.v2");
    expect(savePlan({ ...plan, guestCount: -1 }, getPlanRevision()).ok).toBe(false);
    expect(window.localStorage.getItem("marigold.plan.v2")).toBe(before);
  });

  it("reset removes the legacy copy so it cannot reappear", () => {
    window.localStorage.setItem("marigold.plan.v1", JSON.stringify(buildLocalPlan(FIXTURE_BRIEF)));
    refreshPlanFromStorage();
    clearPlan();
    expect(refreshPlanFromStorage()).toBeNull();
    expect(window.localStorage.getItem("marigold.plan.v1")).toBeNull();
  });

  it("opens existing multi-category quotations with category-scoped legacy IDs", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF);
    const quote = { id: "quote-1", vendorName: "Vendor", amountInr: 10000, guestCoverage: 120, included: [], notes: "", isEstimated: false };
    plan.quotes = [{ ...quote, category: "venue" }, { ...quote, category: "catering" }];
    window.localStorage.setItem("marigold.plan.v2", JSON.stringify({ schemaVersion: 2, revision: 1, plan }));
    expect(refreshPlanFromStorage()?.quotes).toHaveLength(2);
  });
});
