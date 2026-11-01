"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { overageInr } from "@/domain/budget";
import { applyPlanCommand, type PlanCommand } from "@/domain/commands";
import { headcount } from "@/domain/guests";
import { formatInr } from "@/domain/money";
import { validateTaskGraph } from "@/domain/timeline";
import { mergeQuotes } from "@/domain/vendors";
import { CATEGORY_LABELS, type Category, type EventBrief, type EventPlan, type GuestStatus, type PersonalizedIdea, type TaskStatus, type VendorComparisonRow, type VendorQuote } from "@/domain/types";
import { BudgetBoard } from "@/components/planner/BudgetBoard";
import { ChecklistBoard } from "@/components/planner/ChecklistBoard";
import { GuestBoard } from "@/components/planner/GuestBoard";
import { IdeasBoard } from "@/components/planner/IdeasBoard";
import { IntakeWizard } from "@/components/planner/IntakeWizard";
import { PlannerShell, type SectionId } from "@/components/planner/PlannerShell";
import { RevisionComposer } from "@/components/planner/RevisionComposer";
import { TimelineBoard } from "@/components/planner/TimelineBoard";
import { VendorBoard } from "@/components/planner/VendorBoard";
import { Button } from "@/components/ui/Button";
import { clearPlan, emptyPlan, getPlanRevision, getStorageIssue, loadPlan, savePlan, subscribePlan } from "@/lib/storage";

type ApiPlan = { source: "gemini" | "local"; plan: EventPlan; warning?: string | null; changes?: string[] };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The planner could not complete that request.");
  return data;
}

function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function PlannerApp() {
  const storedPlan = useSyncExternalStore(subscribePlan, loadPlan, emptyPlan);
  const plan = storedPlan?.source === "gemini" ? storedPlan : null;
  const [section, setSection] = useState<SectionId>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [vendorCategory, setVendorCategory] = useState<Category>("catering");
  const [questions, setQuestions] = useState<string[]>([]);
  const [rows, setRows] = useState<VendorComparisonRow[]>([]);
  const [preview, setPreview] = useState<ApiPlan | null>(null);
  const [undoPlan, setUndoPlan] = useState<EventPlan | null>(null);

  const rsvpHeadcount = useMemo(() => (plan ? headcount(plan.guests) : 0), [plan]);

  const commitPlan = (next: EventPlan, notice?: string | null, expectedRevision = getPlanRevision()) => {
    const saved = savePlan(next, expectedRevision);
    if (!saved.ok) {
      setError(saved.message);
      return false;
    }
    setWarning(notice ?? null);
    setError("");
    return true;
  };

  const runCommand = (command: PlanCommand) => {
    if (!plan) return;
    const result = applyPlanCommand(plan, command);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    commitPlan(result.plan, result.warning);
  };

  const createPlan = async (brief: EventBrief) => {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<ApiPlan>("/api/plan/generate", { brief });
      commitPlan(result.plan, result.warning);
      setSection("overview");
      setChanges([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate a plan.");
    } finally {
      setBusy(false);
    }
  };

  if (!plan) {
    return (
      <main id="planner-main" className="flex min-h-dvh items-center px-4 py-16">
        <div className="mx-auto w-full max-w-2xl">
          {getStorageIssue() ? <p role="alert" className="mb-4 text-sm font-medium text-danger">{getStorageIssue()}</p> : null}
          <IntakeWizard busy={busy} error={error} onCreate={createPlan} />
        </div>
      </main>
    );
  }

  return (
    <PlannerShell title={plan.title} source={plan.source} section={section} onSection={setSection}>
      {section === "overview" ? (
        <section aria-labelledby="overview-heading" className="space-y-4">
          <div>
            <h1 id="overview-heading" className="font-serif text-5xl leading-tight">{plan.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{plan.rationale}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Occasion", plan.occasion],
              ["Date", plan.eventDate],
              ["Guests", String(plan.guestCount)],
              ["Budget", formatInr(plan.budgetInr)],
              ["City", plan.city],
              ["Vibe", plan.vibe],
              ["Top priority", CATEGORY_LABELS[plan.priorities[0] ?? "catering"]],
              ["Confirmed attendance", String(rsvpHeadcount)],
            ].map(([label, value]) => (
              <div key={label} className="glass rounded-[28px] px-5 py-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">{label}</dt>
                <dd className="mt-2 font-serif text-2xl capitalize">{value}</dd>
              </div>
            ))}
          </dl>
          {overageInr(plan.budgetBreakdown, plan.budgetInr) > 0 ? (
            <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger" role="status">
              Projected spend is over the budget. Open Budget to choose a trade-off.
            </p>
          ) : null}
          <RevisionComposer
            busy={busy}
            changes={changes}
            warning={warning}
            onRevise={async (instruction) => {
              setBusy(true);
              setError("");
              const baseRevision = getPlanRevision();
              try {
                const result = await postJson<ApiPlan>("/api/plan/revise", { plan, instruction, today: todayStamp(), baseRevision });
                if (getPlanRevision() !== baseRevision) {
                  setError("A newer copy of this plan was saved. The preview was discarded.");
                  return;
                }
                setPreview(result);
                setChanges(result.changes ?? []);
                setWarning(result.warning ?? null);
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Could not revise the plan.");
              } finally {
                setBusy(false);
              }
            }}
          />
          {preview ? (
            <div className="glass rounded-[28px] p-5">
              <h2 className="font-serif text-3xl">Preview</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {preview.plan.guestCount} guests, {formatInr(preview.plan.budgetInr)}, {preview.plan.eventDate}. Source {preview.source}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setUndoPlan(plan);
                    if (commitPlan(preview.plan, preview.warning)) setPreview(null);
                  }}
                >
                  Accept revision
                </Button>
                <Button variant="secondary" onClick={() => setPreview(null)}>Discard preview</Button>
              </div>
            </div>
          ) : null}
          {undoPlan ? (
            <Button
              variant="ghost"
              onClick={() => {
                if (commitPlan(undoPlan, "Restored the plan from before the last accepted revision.")) {
                  setUndoPlan(null);
                  setChanges([]);
                }
              }}
            >
              Undo last revision
            </Button>
          ) : null}
          {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
          <Button
            variant="ghost"
            onClick={() => {
              clearPlan();
              setChanges([]);
            }}
          >
            Start over
          </Button>
        </section>
      ) : null}

      {section === "budget" ? (
        <BudgetBoard
          plan={plan}
          busy={busy}
          onConfirm={(category, vendorName, amountInr) => runCommand({ type: "confirm-quote", category, vendorName, amountInr })}
          onApplyScenario={(scenarioId) => runCommand({ type: "apply-scenario", scenarioId })}
          onAskGemini={async () => {
            setBusy(true);
            try {
              const result = await postJson<ApiPlan>("/api/plan/tradeoffs", { plan });
              commitPlan(result.plan, result.warning);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not fetch trade-offs.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {section === "timeline" ? (
        <TimelineBoard
          plan={plan}
          busy={busy}
          warnings={validateTaskGraph(plan.timelineTasks, plan.eventDate, todayStamp())}
          onStatus={(id, status: TaskStatus) => runCommand({ type: "set-task-status", taskId: id, status, today: todayStamp() })}
          onDateChange={(eventDate) => runCommand({ type: "set-event-date", eventDate, today: todayStamp() })}
          onReschedule={async () => {
            setBusy(true);
            try {
              const result = await postJson<ApiPlan>("/api/plan/timeline", { plan, eventDate: plan.eventDate, today: todayStamp() });
              commitPlan(result.plan, result.warning);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not reschedule.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {section === "vendors" ? (
        <VendorBoard
          category={vendorCategory}
          capInr={plan.budgetBreakdown.find((line) => line.category === vendorCategory)?.amountInr ?? 0}
          questions={questions}
          rows={rows}
          busy={busy}
          warning={warning}
          onCategory={setVendorCategory}
          onAskQuestions={async (mustHaves) => {
            setBusy(true);
            try {
              const result = await postJson<{ questions: string[]; warning?: string | null }>("/api/vendors/questions", {
                category: vendorCategory,
                mustHaves,
                guestCoverage: plan.guestCount,
                budgetCapInr: plan.budgetBreakdown.find((line) => line.category === vendorCategory)?.amountInr ?? 0,
                occasion: plan.occasion,
                city: plan.city,
              });
              setQuestions(result.questions);
              setWarning(result.warning ?? null);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not draft questions.");
            } finally {
              setBusy(false);
            }
          }}
          onCompare={async (quotes) => {
            setBusy(true);
            try {
              const payload = quotes.map((quote, index) => ({
                ...quote,
                id: `quote-${index + 1}`,
                category: vendorCategory,
                isEstimated: false,
              }));
              const result = await postJson<{ vendorComparisonMatrix: VendorComparisonRow[]; questions?: string[]; warning?: string | null }>("/api/vendors/compare", {
                quotes: payload,
                headcount: plan.guestCount,
                capInr: plan.budgetBreakdown.find((line) => line.category === vendorCategory)?.amountInr ?? 0,
                category: vendorCategory,
                mustHaves: plan.notes.trim() || `${plan.occasion} in ${plan.city}`,
                occasion: plan.occasion,
                city: plan.city,
              });
              setRows(result.vendorComparisonMatrix);
              if (result.questions?.length) setQuestions(result.questions);
              setWarning(result.warning ?? null);
              commitPlan({ ...plan, quotes: mergeQuotes(plan.quotes, payload as VendorQuote[]) }, result.warning);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not compare quotes.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {section === "guests" ? (
        <GuestBoard
          guests={plan.guests}
          onStatus={(id, status: GuestStatus) => {
            const guest = plan.guests.find((item) => item.id === id);
            if (!guest) return;
            runCommand({ type: "upsert-guest", guest: { ...guest, status } });
          }}
          onApplyHeadcount={(nextCount) => runCommand({ type: "apply-headcount", guestCount: nextCount, today: todayStamp() })}
          onAdd={(guest) => {
            const id = globalThis.crypto?.randomUUID?.() ?? `guest-${plan.guests.length + 1}`;
            runCommand({ type: "upsert-guest", guest: { ...guest, id } });
          }}
        />
      ) : null}

      {section === "checklist" ? (
        <ChecklistBoard
          items={plan.checklist}
          onToggle={(id) => {
            const item = plan.checklist.find((entry) => entry.id === id);
            if (!item) return;
            runCommand({ type: "set-checklist", itemId: id, done: !item.done });
          }}
        />
      ) : null}

      {section === "ideas" ? (
        <IdeasBoard
          ideas={plan.ideas ?? []}
          busy={busy}
          warning={warning}
          onSuggest={async () => {
            setBusy(true);
            try {
              const result = await postJson<{ ideas: PersonalizedIdea[]; warning?: string | null }>("/api/plan/ideas", { plan });
              commitPlan({ ...plan, ideas: result.ideas }, result.warning);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not suggest ideas.");
            } finally {
              setBusy(false);
            }
          }}
          onStatus={(ideaId, status) => runCommand({ type: "set-idea-status", ideaId, status })}
          onAdd={(ideaId) => runCommand({ type: "add-idea", ideaId, today: todayStamp() })}
        />
      ) : null}
      {section !== "overview" && error ? <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p> : null}
    </PlannerShell>
  );
}
