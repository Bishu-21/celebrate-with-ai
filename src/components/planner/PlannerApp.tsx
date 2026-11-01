"use client";

import dynamic from "next/dynamic";
import { overageInr } from "@/domain/budget";
import { formatInr } from "@/domain/money";
import { IntakeWizard } from "@/components/planner/IntakeWizard";
import { PlannerShell } from "@/components/planner/PlannerShell";
import { RevisionComposer } from "@/components/planner/RevisionComposer";
import { usePlannerSession } from "@/components/planner/usePlannerSession";
import { Button } from "@/components/ui/Button";
import { getStorageIssue } from "@/lib/storage";

function SectionFallback() {
  return <p role="status" className="text-sm text-muted-foreground">Loading this section.</p>;
}

const BudgetBoard = dynamic(() => import("@/components/planner/BudgetBoard").then((mod) => mod.BudgetBoard), { loading: SectionFallback });
const ChecklistBoard = dynamic(() => import("@/components/planner/ChecklistBoard").then((mod) => mod.ChecklistBoard), { loading: SectionFallback });
const GuestBoard = dynamic(() => import("@/components/planner/GuestBoard").then((mod) => mod.GuestBoard), { loading: SectionFallback });
const IdeasBoard = dynamic(() => import("@/components/planner/IdeasBoard").then((mod) => mod.IdeasBoard), { loading: SectionFallback });
const TimelineBoard = dynamic(() => import("@/components/planner/TimelineBoard").then((mod) => mod.TimelineBoard), { loading: SectionFallback });
const VendorBoard = dynamic(() => import("@/components/planner/VendorBoard").then((mod) => mod.VendorBoard), { loading: SectionFallback });

export function PlannerApp() {
  const session = usePlannerSession();
  const { plan } = session;

  if (!plan) {
    return (
      <main id="planner-main" className="flex min-h-dvh items-center px-4 py-16">
        <div className="mx-auto w-full max-w-2xl">
          {getStorageIssue() ? <p role="alert" className="mb-4 text-sm font-medium text-danger">{getStorageIssue()}</p> : null}
          <IntakeWizard busy={session.busy} error={session.error} onCreate={session.createPlan} />
        </div>
      </main>
    );
  }

  return (
    <PlannerShell title={plan.title} source={plan.source} section={session.section} onSection={session.setSection}>
      {session.section === "overview" ? (
        <section aria-labelledby="overview-heading" className="space-y-4">
          <div>
            <h1 id="overview-heading" className="font-serif text-5xl leading-tight">{plan.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{plan.rationale}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {session.overviewFacts.map(([label, value]) => (
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
            busy={session.busy}
            changes={session.changes}
            warning={session.warning}
            onRevise={session.revise}
          />
          {session.preview ? (
            <div className="glass rounded-[28px] p-5">
              <h2 className="font-serif text-3xl">Preview</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {session.preview.plan.guestCount} guests, {formatInr(session.preview.plan.budgetInr)}, {session.preview.plan.eventDate}. Source {session.preview.source}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={session.acceptPreview}>Accept revision</Button>
                <Button variant="secondary" onClick={session.discardPreview}>Discard preview</Button>
              </div>
            </div>
          ) : null}
          {session.undoPlan ? (
            <Button variant="ghost" onClick={session.undoRevision}>Undo last revision</Button>
          ) : null}
          {session.error ? <p role="alert" className="text-sm font-medium text-danger">{session.error}</p> : null}
          <Button variant="ghost" onClick={session.startOver}>Start over</Button>
        </section>
      ) : null}

      {session.section === "budget" ? (
        <BudgetBoard
          plan={plan}
          busy={session.busy}
          onConfirm={session.confirmQuote}
          onApplyScenario={session.applyScenario}
          onAskGemini={session.askTradeoffs}
        />
      ) : null}

      {session.section === "timeline" ? (
        <TimelineBoard
          plan={plan}
          busy={session.busy}
          warnings={session.timelineWarnings}
          onStatus={session.setTaskStatus}
          onDateChange={session.setEventDate}
          onReschedule={session.reschedule}
        />
      ) : null}

      {session.section === "vendors" ? (
        <VendorBoard
          key={`${plan.id}-${session.vendorCategory}`}
          category={session.vendorCategory}
          capInr={session.vendorCapInr}
          savedQuotes={session.savedQuotes}
          initialMustHaves={session.vendorBrief?.mustHaves || plan.notes}
          questions={session.shownQuestions}
          rows={session.shownRows}
          busy={session.busy}
          warning={session.warning}
          onCategory={session.changeVendorCategory}
          onAskQuestions={session.askQuestions}
          onCompare={session.compareQuotes}
        />
      ) : null}

      {session.section === "guests" ? (
        <GuestBoard
          guests={plan.guests}
          onStatus={session.setGuestStatus}
          onApplyHeadcount={session.applyHeadcount}
          onAdd={session.addGuest}
        />
      ) : null}

      {session.section === "checklist" ? (
        <ChecklistBoard
          items={plan.checklist}
          onToggle={session.toggleChecklist}
        />
      ) : null}

      {session.section === "ideas" ? (
        <IdeasBoard
          ideas={plan.ideas ?? []}
          busy={session.busy}
          warning={session.warning}
          onSuggest={session.suggestIdeas}
          onStatus={session.setIdeaStatus}
          onAdd={session.addIdea}
        />
      ) : null}
      {session.section !== "overview" && session.error ? <p role="alert" className="mt-4 text-sm font-medium text-danger">{session.error}</p> : null}
    </PlannerShell>
  );
}
