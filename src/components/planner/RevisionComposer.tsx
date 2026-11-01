"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";

export function RevisionComposer({
  busy,
  changes,
  warning,
  onRevise,
}: {
  busy: boolean;
  changes: string[];
  warning?: string | null;
  onRevise: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState("We have 50 more guests, the budget dropped by ₹2,00,000, and the event is 2 weeks earlier.");

  return (
    <form
      className="glass rounded-[28px] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onRevise(instruction);
      }}
    >
      <h2 className="font-serif text-3xl">Revise this plan</h2>
      <p className="mt-1 text-sm text-muted-foreground">The event id and finished tasks stay. Gemini rewrites notes. The app recomputes money and dates.</p>
      <label className="mt-4 block text-sm font-semibold" htmlFor="revision-note">
        What changed?
      </label>
      <TextArea id="revision-note" className="mt-2" value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      <Button className="mt-3" type="submit" disabled={busy || instruction.trim().length < 8}>
        {busy ? "Checking the change…" : "Preview the change"}
      </Button>
      <div aria-live="polite" className="mt-3 text-sm">
        {warning ? <p className="text-gold">{warning}</p> : null}
        {changes.length ? (
          <ul className="mt-2 list-disc pl-5">
            {changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </form>
  );
}
