"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { applyPlanCommand, type PlanCommand } from "@/domain/commands";
import { headcount } from "@/domain/guests";
import { mergeIdeas } from "@/domain/ideas";
import { formatInr } from "@/domain/money";
import { validateTaskGraph } from "@/domain/timeline";
import { compareVendorQuotes, mergeQuotes } from "@/domain/vendors";
import { CATEGORY_LABELS, type Category, type EventBrief, type EventPlan, type GuestStatus, type PersonalizedIdea, type TaskStatus, type VendorComparisonRow, type VendorQuote } from "@/domain/types";
import type { SectionId } from "@/components/planner/PlannerShell";
import { assertPlanVersion, capturePlanVersion, errorText, postJson, type PlanVersion } from "@/lib/client-api";
import { clearPlan, emptyPlan, getPlanRevision, loadPlan, savePlan, subscribePlan } from "@/lib/storage";

type ApiPlan = { source: "gemini" | "local"; plan: EventPlan; warning?: string | null; changes?: string[] };

function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function usePlannerSession() {
  const storedPlan = useSyncExternalStore(subscribePlan, loadPlan, emptyPlan);
  const plan = storedPlan;
  const [section, setSection] = useState<SectionId>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [vendorCategory, setVendorCategory] = useState<Category>("catering");
  const [questions, setQuestions] = useState<string[]>([]);
  const [rows, setRows] = useState<VendorComparisonRow[]>([]);
  const [preview, setPreview] = useState<(ApiPlan & { version: PlanVersion }) | null>(null);
  const [undoPlan, setUndoPlan] = useState<{ plan: EventPlan; version: PlanVersion } | null>(null);

  const rsvpHeadcount = useMemo(() => (plan ? headcount(plan.guests) : 0), [plan]);
  const guestsById = useMemo(() => new Map(plan?.guests.map((guest) => [guest.id, guest]) ?? []), [plan]);
  const checklistById = useMemo(() => new Map(plan?.checklist.map((item) => [item.id, item]) ?? []), [plan]);
  const budgetByCategory = useMemo(() => new Map(plan?.budgetBreakdown.map((line) => [line.category, line]) ?? []), [plan]);
  const briefsByCategory = useMemo(() => new Map(plan?.vendorBriefs.map((brief) => [brief.category, brief]) ?? []), [plan]);
  const vendorCapInr = budgetByCategory.get(vendorCategory)?.amountInr ?? 0;
  const overviewFacts = useMemo(
    () =>
      plan
        ? [
            ["Occasion", plan.occasion],
            ["Date", plan.eventDate],
            ["Guests", String(plan.guestCount)],
            ["Budget", formatInr(plan.budgetInr)],
            ["City", plan.city],
            ["Vibe", plan.vibe],
            ["Top priority", CATEGORY_LABELS[plan.priorities[0] ?? "catering"]],
            ["Confirmed attendance", String(rsvpHeadcount)],
          ]
        : [],
    [plan, rsvpHeadcount],
  );
  const timelineWarnings = useMemo(
    () => (plan ? validateTaskGraph(plan.timelineTasks, plan.eventDate, todayStamp()) : []),
    [plan],
  );

  const commitPlan = useCallback((next: EventPlan, notice?: string | null, expectedRevision = getPlanRevision()) => {
    const saved = savePlan(next, expectedRevision);
    if (!saved.ok) {
      setError(saved.message);
      return false;
    }
    setWarning(notice ?? null);
    setError("");
    return true;
  }, []);

  const runCommand = useCallback((command: PlanCommand) => {
    if (!plan) return;
    const result = applyPlanCommand(plan, command);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    commitPlan(result.plan, result.warning);
  }, [plan, commitPlan]);

  const runRequest = useCallback(async (work: () => Promise<void>, fallback: string, clearError = false) => {
    setBusy(true);
    if (clearError) setError("");
    try {
      await work();
    } catch (reason) {
      setError(errorText(reason, fallback));
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmQuote = useCallback((category: Category, vendorName: string, amountInr: number) => {
    runCommand({ type: "confirm-quote", category, vendorName, amountInr });
  }, [runCommand]);
  const applyScenario = useCallback((scenarioId: string) => {
    runCommand({ type: "apply-scenario", scenarioId });
  }, [runCommand]);
  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    runCommand({ type: "set-task-status", taskId: id, status, today: todayStamp() });
  }, [runCommand]);
  const setEventDate = useCallback((eventDate: string) => {
    runCommand({ type: "set-event-date", eventDate, today: todayStamp() });
  }, [runCommand]);
  const setGuestStatus = useCallback((id: string, status: GuestStatus) => {
    if (!plan) return;
    const guest = guestsById.get(id);
    if (!guest) return;
    runCommand({ type: "upsert-guest", guest: { ...guest, status } });
  }, [guestsById, plan, runCommand]);
  const applyHeadcount = useCallback((nextCount: number) => {
    runCommand({ type: "apply-headcount", guestCount: nextCount, today: todayStamp() });
  }, [runCommand]);
  const addGuest = useCallback((guest: Omit<EventPlan["guests"][number], "id">) => {
    if (!plan) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `guest-${plan.guests.length + 1}`;
    runCommand({ type: "upsert-guest", guest: { ...guest, id } });
  }, [plan, runCommand]);
  const toggleChecklist = useCallback((id: string) => {
    if (!plan) return;
    const item = checklistById.get(id);
    if (!item) return;
    runCommand({ type: "set-checklist", itemId: id, done: !item.done });
  }, [checklistById, plan, runCommand]);
  const setIdeaStatus = useCallback((ideaId: string, status: PersonalizedIdea["status"]) => {
    runCommand({ type: "set-idea-status", ideaId, status });
  }, [runCommand]);
  const addIdea = useCallback((ideaId: string) => {
    runCommand({ type: "add-idea", ideaId, today: todayStamp() });
  }, [runCommand]);

  const createPlan = useCallback((brief: EventBrief) => runRequest(async () => {
    const result = await postJson<ApiPlan>("/api/plan/generate", { brief });
    commitPlan(result.plan, result.warning);
    setSection("overview");
    setChanges([]);
  }, "Could not generate a plan.", true), [commitPlan, runRequest]);

  const revise = useCallback((instruction: string) => runRequest(async () => {
    if (!plan) return;
    const baseRevision = getPlanRevision();
    const result = await postJson<ApiPlan>("/api/plan/revise", { plan, instruction, today: todayStamp(), baseRevision });
    if (getPlanRevision() !== baseRevision) {
      setError("A newer copy of this plan was saved. The preview was discarded.");
      return;
    }
    setPreview({ ...result, version: capturePlanVersion() });
    setChanges(result.changes ?? []);
    setWarning(result.warning ?? null);
  }, "Could not revise the plan.", true), [plan, runRequest]);

  const acceptPreview = useCallback(() => {
    if (!plan || !preview) return;
    try {
      assertPlanVersion(preview.version);
      if (commitPlan(preview.plan, preview.warning, preview.version.revision)) {
        setUndoPlan({ plan, version: capturePlanVersion() });
        setPreview(null);
      }
    } catch (reason) {
      setError(errorText(reason, "The plan changed. Generate another preview."));
      setPreview(null);
    }
  }, [commitPlan, plan, preview]);

  const discardPreview = useCallback(() => setPreview(null), []);

  const undoRevision = useCallback(() => {
    if (!undoPlan) return;
    try {
      assertPlanVersion(undoPlan.version);
      if (commitPlan(undoPlan.plan, "Restored the plan from before the last accepted revision.", undoPlan.version.revision)) {
        setUndoPlan(null);
        setChanges([]);
      }
    } catch (reason) {
      setError(errorText(reason, "The plan changed since that revision."));
      setUndoPlan(null);
    }
  }, [commitPlan, undoPlan]);

  const startOver = useCallback(() => {
    const cleared = clearPlan();
    if (!cleared.ok) {
      setError(cleared.message);
      return;
    }
    setError("");
    setChanges([]);
    setPreview(null);
    setUndoPlan(null);
    setQuestions([]);
    setRows([]);
    setWarning(null);
  }, []);

  const askTradeoffs = useCallback(() => runRequest(async () => {
    if (!plan) return;
    const result = await postJson<ApiPlan>("/api/plan/tradeoffs", { plan });
    commitPlan(result.plan, result.warning);
  }, "Could not fetch trade-offs."), [commitPlan, plan, runRequest]);

  const reschedule = useCallback(() => runRequest(async () => {
    if (!plan) return;
    const result = await postJson<ApiPlan>("/api/plan/timeline", { plan, eventDate: plan.eventDate, today: todayStamp() });
    commitPlan(result.plan, result.warning);
  }, "Could not reschedule."), [commitPlan, plan, runRequest]);

  const changeVendorCategory = useCallback((category: Category) => {
    setVendorCategory(category);
    setRows([]);
    setQuestions([]);
    setWarning(null);
  }, []);

  const askQuestions = useCallback((mustHaves: string) => runRequest(async () => {
    if (!plan) return;
    const result = await postJson<{ questions: string[]; warning?: string | null }>("/api/vendors/questions", {
      category: vendorCategory,
      mustHaves,
      guestCoverage: plan.guestCount,
      budgetCapInr: vendorCapInr,
      occasion: plan.occasion,
      city: plan.city,
    });
    setQuestions(result.questions);
    setWarning(result.warning ?? null);
  }, "Could not draft questions."), [plan, runRequest, vendorCapInr, vendorCategory]);

  const compareQuotes = useCallback((quotes: Array<Omit<VendorQuote, "id" | "category" | "isEstimated">>, mustHaves: string) => runRequest(async () => {
    if (!plan) return;
    const payload = quotes.map((quote, index) => ({
      ...quote,
      id: `${vendorCategory}-quote-${index + 1}`,
      category: vendorCategory,
      isEstimated: false as const,
    }));
    const result = await postJson<{ vendorComparisonMatrix: VendorComparisonRow[]; questions?: string[]; warning?: string | null }>("/api/vendors/compare", {
      quotes: payload,
      headcount: plan.guestCount,
      capInr: vendorCapInr,
      category: vendorCategory,
      mustHaves: mustHaves.trim() || `${plan.occasion} in ${plan.city}`,
      occasion: plan.occasion,
      city: plan.city,
    });
    setRows(result.vendorComparisonMatrix);
    if (result.questions?.length) setQuestions(result.questions);
    setWarning(result.warning ?? null);
    commitPlan({ ...plan, quotes: mergeQuotes(plan.quotes, payload) }, result.warning);
  }, "Could not compare quotes."), [commitPlan, plan, runRequest, vendorCapInr, vendorCategory]);

  const suggestIdeas = useCallback(() => runRequest(async () => {
    if (!plan) return;
    const result = await postJson<{ ideas: PersonalizedIdea[]; warning?: string | null }>("/api/plan/ideas", { plan });
    commitPlan({ ...plan, ideas: mergeIdeas(plan.ideas ?? [], result.ideas) }, result.warning);
  }, "Could not suggest ideas."), [commitPlan, plan, runRequest]);

  const savedQuotes = useMemo(
    () => plan?.quotes.filter((quote) => quote.category === vendorCategory) ?? [],
    [plan, vendorCategory],
  );
  const vendorBrief = briefsByCategory.get(vendorCategory);
  const shownQuestions = questions.length ? questions : vendorBrief?.questions ?? [];
  const shownRows = useMemo(
    () => (rows.length ? rows : plan ? compareVendorQuotes(savedQuotes, plan.guestCount, { [vendorCategory]: vendorCapInr }) : []),
    [plan, rows, savedQuotes, vendorCapInr, vendorCategory],
  );

  return {
    plan,
    section,
    setSection,
    busy,
    error,
    changes,
    warning,
    vendorCategory,
    vendorCapInr,
    savedQuotes,
    vendorBrief,
    shownQuestions,
    shownRows,
    preview,
    undoPlan,
    overviewFacts,
    timelineWarnings,
    createPlan,
    revise,
    acceptPreview,
    discardPreview,
    undoRevision,
    startOver,
    confirmQuote,
    applyScenario,
    setTaskStatus,
    setEventDate,
    setGuestStatus,
    applyHeadcount,
    addGuest,
    toggleChecklist,
    setIdeaStatus,
    addIdea,
    askTradeoffs,
    reschedule,
    changeVendorCategory,
    askQuestions,
    compareQuotes,
    suggestIdeas,
  };
}
