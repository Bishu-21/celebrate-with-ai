"use client";

import { memo, useState } from "react";
import { overageInr, projectSpend, protectsTopPriority } from "@/domain/budget";
import { formatInr, parseInrAmount } from "@/domain/money";
import { CATEGORY_LABELS, type BudgetLine, type Category, type EventPlan } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";

const BudgetRow = memo(function BudgetRow({
  line,
  share,
  onConfirm,
}: {
  line: BudgetLine;
  share: number;
  onConfirm: (category: Category, vendorName: string, amountInr: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState(String(line.amountInr));
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-3 pr-3 text-left font-semibold">
        {CATEGORY_LABELS[line.category]}
      </th>
      <td className="py-3 pr-3">{formatInr(line.amountInr)}</td>
      <td className="py-3 pr-3">{share}%</td>
      <td className="py-3 pr-3">
        <Badge tone={line.isEstimated ? "estimate" : "confirmed"}>{line.isEstimated ? line.origin === "local" ? "Local estimate" : "AI estimate" : "Confirmed quote"}</Badge>
      </td>
      <td className="py-3 text-sm text-muted-foreground">{line.assumption}</td>
      <td className="py-3 text-right">
        {line.isEstimated ? (
          open ? (
            <form
              className="flex flex-col items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onConfirm(line.category, vendorName, parseInrAmount(amount));
                setOpen(false);
              }}
            >
              <TextInput aria-label={`${CATEGORY_LABELS[line.category]} vendor`} value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor" />
              <TextInput aria-label={`${CATEGORY_LABELS[line.category]} quoted amount`} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
              <Button variant="secondary" type="submit">Save quote</Button>
            </form>
          ) : (
            <Button variant="secondary" aria-label={`Enter a confirmed quote for ${CATEGORY_LABELS[line.category]}`} onClick={() => setOpen(true)}>
              Confirm
            </Button>
          )
        ) : null}
      </td>
    </tr>
  );
});

export const BudgetBoard = memo(function BudgetBoard({
  plan,
  onConfirm,
  onApplyScenario,
  onAskGemini,
  busy,
}: {
  plan: EventPlan;
  onConfirm: (category: Category, vendorName: string, amountInr: number) => void;
  onApplyScenario: (scenarioId: string) => void;
  onAskGemini: () => void;
  busy: boolean;
}) {
  const spend = projectSpend(plan.budgetBreakdown);
  const over = overageInr(plan.budgetBreakdown, plan.budgetInr);
  return (
    <section aria-labelledby="budget-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="budget-heading" className="font-serif text-4xl">Budget</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Planned {formatInr(plan.budgetInr)}. Projected {formatInr(spend)}.
          </p>
        </div>
        <Button variant="secondary" onClick={onAskGemini} disabled={busy}>
          {busy ? "Asking Gemini…" : "Ask Gemini for trade-offs"}
        </Button>
      </div>
      {over > 0 ? (
        <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger" role="status">
          This plan is {formatInr(over)} over budget. Cuts below protect {CATEGORY_LABELS[plan.priorities[0] ?? "catering"].toLowerCase()} instead of trimming everything at once.
        </p>
      ) : (
        <p className="mt-4 text-sm font-medium text-ok" role="status">
          Projected spend fits the budget.
        </p>
      )}
      <div className="glass mt-4 overflow-x-auto rounded-[28px] p-4">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Budget categories, amounts, share of the total, and whether each figure is still an estimate.</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th scope="col" className="pb-2 pr-4">Category</th>
              <th scope="col" className="pb-2 pr-4">Amount</th>
              <th scope="col" className="pb-2 pr-4">Share</th>
              <th scope="col" className="pb-2 pr-4">Status</th>
              <th scope="col" className="pb-2 pr-4">Assumption</th>
              <th scope="col" className="pb-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {plan.budgetBreakdown.map((line) => (
              <BudgetRow
                key={line.category}
                line={line}
                share={plan.budgetInr ? Math.round((line.amountInr / plan.budgetInr) * 100) : 0}
                onConfirm={onConfirm}
              />
            ))}
          </tbody>
        </table>
      </div>
      {plan.tradeOffScenarios.length ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {plan.tradeOffScenarios.map((scenario) => {
            const safe = protectsTopPriority(plan.budgetBreakdown, scenario.lines, scenario.protectedPriority);
            return (
              <article key={scenario.id} className="glass rounded-[28px] p-5">
                <h3 className="font-serif text-2xl">{scenario.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{scenario.summary}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gold">{safe ? "Protects top priority" : "Review before applying"}</p>
                <Button className="mt-3" variant="secondary" onClick={() => onApplyScenario(scenario.id)}>
                  Apply this scenario
                </Button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
});
