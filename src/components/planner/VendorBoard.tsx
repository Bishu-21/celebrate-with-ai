"use client";

import { useState } from "react";
import { formatInr } from "@/domain/money";
import { CATEGORIES, CATEGORY_LABELS, type Category, type VendorComparisonRow, type VendorQuote } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, selectFieldClass, TextArea, TextInput } from "@/components/ui/Field";

export function VendorBoard({
  category,
  capInr,
  questions,
  rows,
  busy,
  warning,
  onCategory,
  onAskQuestions,
  onCompare,
}: {
  category: Category;
  capInr: number;
  questions: string[];
  rows: VendorComparisonRow[];
  busy: boolean;
  warning?: string | null;
  onCategory: (category: Category) => void;
  onAskQuestions: (mustHaves: string) => void;
  onCompare: (quotes: Array<Omit<VendorQuote, "id" | "category" | "isEstimated">>) => void;
}) {
  const [mustHaves, setMustHaves] = useState("Step-free access and a clear list of exclusions.");
  const [quotes, setQuotes] = useState([
    { vendorName: "", amountInr: 0, guestCoverage: 100, includedText: "", notes: "" },
    { vendorName: "", amountInr: 0, guestCoverage: 100, includedText: "", notes: "" },
  ]);

  return (
    <section aria-labelledby="vendor-heading">
      <h2 id="vendor-heading" className="font-serif text-4xl">Vendors</h2>
      <p className="mt-1 text-sm text-muted-foreground">Paste quotations you already have. Marigold does not invent who is free that weekend.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[16rem_1fr]">
        <Field label="Category">
          <select className={selectFieldClass()} value={category} onChange={(event) => onCategory(event.target.value as Category)}>
            {CATEGORIES.filter((item) => item !== "miscellaneous").map((item) => (
              <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>
            ))}
          </select>
        </Field>
        <p className="self-end text-sm">Category cap from the plan: {formatInr(capInr)}. AI notes stay estimates.</p>
      </div>
      <Field label="Must-haves">
        <TextArea value={mustHaves} onChange={(event) => setMustHaves(event.target.value)} />
      </Field>
      <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => onAskQuestions(mustHaves)}>
        {busy ? "Asking Gemini…" : "Draft vendor questions"}
      </Button>
      {questions.length ? (
        <ul className="glass mt-4 list-disc space-y-1 rounded-[28px] p-6 pl-10 text-sm">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {quotes.map((quote, index) => (
          <fieldset key={index} className="glass rounded-[28px] p-5">
            <legend className="px-1 text-sm font-bold">Quote {index + 1}</legend>
            <div className="mt-2 space-y-3">
              <Field label="Vendor">
                <TextInput value={quote.vendorName} onChange={(event) => setQuotes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, vendorName: event.target.value } : item))} />
              </Field>
              <Field label="Amount (INR)">
                <TextInput type="number" min={0} value={quote.amountInr} onChange={(event) => setQuotes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amountInr: Number(event.target.value) } : item))} />
              </Field>
              <Field label="Guests covered">
                <TextInput type="number" min={0} value={quote.guestCoverage} onChange={(event) => setQuotes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, guestCoverage: Number(event.target.value) } : item))} />
              </Field>
              <Field label="Included" hint="Comma-separated.">
                <TextInput value={quote.includedText} onChange={(event) => setQuotes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, includedText: event.target.value } : item))} />
              </Field>
              <Field label="Notes" hint="Mention GST, overtime, or transport if the vendor did.">
                <TextArea value={quote.notes} onChange={(event) => setQuotes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} />
              </Field>
            </div>
          </fieldset>
        ))}
      </div>
      <Button
        className="mt-4"
        disabled={busy}
        onClick={() =>
          onCompare(
            quotes.map((quote) => ({
              vendorName: quote.vendorName,
              amountInr: quote.amountInr,
              guestCoverage: quote.guestCoverage,
              included: quote.includedText.split(",").map((item) => item.trim()).filter(Boolean),
              notes: quote.notes,
            })),
          )
        }
      >
        Compare quotations
      </Button>
      {warning ? <p className="mt-3 text-sm text-gold" role="status">{warning}</p> : null}
      {rows.length ? (
        <div className="glass mt-4 overflow-x-auto rounded-[28px] p-4">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Comparison of the quotations you entered. Coverage and cap are calculated in the app.</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th scope="col" className="pb-2 pr-4">Vendor</th>
                <th scope="col" className="pb-2 pr-4">Amount</th>
                <th scope="col" className="pb-2 pr-4">Coverage</th>
                <th scope="col" className="pb-2 pr-4">Cap</th>
                <th scope="col" className="pb-2 pr-4">Extras in the notes</th>
                <th scope="col" className="pb-2 pr-4">Gemini note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.quoteId} className="border-t border-border">
                  <th scope="row" className="py-3 text-left">{row.vendorName}</th>
                  <td className="py-3">{formatInr(row.amountInr)} {row.isEstimated ? <Badge tone="estimate">AI estimate</Badge> : <Badge tone="confirmed">Entered quote</Badge>}</td>
                  <td className="py-3">{row.coversHeadcount ? "Covers headcount" : `Short of headcount (${row.guestCoverage})`}</td>
                  <td className="py-3">{row.withinCap ? "Inside cap" : "Over cap"}</td>
                  <td className="py-3">{row.hiddenChargeNotes.join("; ") || "None noted"}</td>
                  <td className="py-3">{row.fitSummary || "No Gemini note for this quote."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
