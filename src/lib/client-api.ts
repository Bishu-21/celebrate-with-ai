import { getPlanRevision, loadPlan } from "@/lib/storage";

export type PlanVersion = { planId: string | null; revision: number };

export function capturePlanVersion(): PlanVersion {
  const plan = loadPlan();
  return { planId: plan?.id ?? null, revision: getPlanRevision() };
}

export function errorText(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function assertPlanVersion(expected: PlanVersion): void {
  const current = capturePlanVersion();
  if (expected.planId !== current.planId || expected.revision !== current.revision) {
    throw new Error("A newer copy of this plan was saved. This result was discarded to protect your changes.");
  }
}

/** Every async write is tied to the saved event and revision that produced it. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const version = capturePlanVersion();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: T & { error?: string };
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response. Your saved plan is unchanged.");
    }
    if (!response.ok) throw new Error(data.error || "The planner could not complete that request.");
    assertPlanVersion(version);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The request timed out. Your saved plan is unchanged; try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
