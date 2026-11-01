import { Suspense, lazy, type ComponentType } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerApp } from "@/components/planner/PlannerApp";
import { buildLocalPlan } from "@/domain/local-plan";
import { clearPlan, getPlanRevision, loadPlan, savePlan } from "@/lib/storage";
import { FIXTURE_BRIEF } from "./brief";

vi.mock("next/dynamic", () => ({ default: (loader: () => Promise<ComponentType>) => {
  const Component = lazy(async () => ({ default: await loader() }));
  return function Dynamic(props: object) { return <Suspense fallback={<p>Loading</p>}><Component {...props} /></Suspense>; };
} }));

describe("planner recovery and concurrent edits", () => {
  beforeEach(() => { localStorage.clear(); clearPlan(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("opens a locally recalculated event rather than hiding it after AI fails", () => {
    savePlan(buildLocalPlan(FIXTURE_BRIEF), 0);
    render(<PlannerApp />);
    expect(screen.getByRole("heading", { name: FIXTURE_BRIEF.title })).toBeInTheDocument();
  });

  it("discards an AI result if another edit was saved while it was running", async () => {
    const plan = { ...buildLocalPlan(FIXTURE_BRIEF), source: "gemini" as const };
    savePlan(plan, 0);
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const user = userEvent.setup();
    render(<PlannerApp />);
    await user.click(screen.getByRole("button", { name: /02 Budget/ }));
    await user.click(await screen.findByRole("button", { name: /Ask Gemini for trade-offs/ }));
    act(() => { savePlan({ ...plan, city: "Pune" }, getPlanRevision()); });
    await act(async () => { finish(Response.json({ source: "gemini", plan })); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/newer|changed/i));
    expect(loadPlan()?.city).toBe("Pune");
  });

  it("rejects an accepted preview if the plan changed after the preview arrived", async () => {
    const plan = { ...buildLocalPlan(FIXTURE_BRIEF), source: "gemini" as const };
    savePlan(plan, 0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "gemini", plan: { ...plan, guestCount: 170 }, changes: ["50 more guests"] })));
    const user = userEvent.setup();
    render(<PlannerApp />);
    await user.click(screen.getByRole("button", { name: "Preview the change" }));
    const accept = await screen.findByRole("button", { name: "Accept revision" });
    act(() => { savePlan({ ...plan, city: "Pune" }, getPlanRevision()); });
    await user.click(accept);
    expect(loadPlan()?.city).toBe("Pune");
    expect(screen.getByRole("alert")).toHaveTextContent(/newer|changed/i);
  });

  it("shows a recoverable error if the browser refuses to reset the saved plan", async () => {
    savePlan({ ...buildLocalPlan(FIXTURE_BRIEF), source: "gemini" }, 0);
    const user = userEvent.setup();
    render(<PlannerApp />);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/storage|browser/i);
    expect(screen.getByRole("heading", { name: FIXTURE_BRIEF.title })).toBeInTheDocument();
  });
});
