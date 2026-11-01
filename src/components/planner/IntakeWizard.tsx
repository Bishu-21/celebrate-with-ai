"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type EventBrief, type Occasion, type Vibe } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { Field, selectFieldClass, TextArea, TextInput } from "@/components/ui/Field";
import { isRealIsoDate } from "@/domain/money";
import { eventBriefSchema } from "@/lib/schemas";

function defaultEventDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const EMPTY: EventBrief = {
  occasion: "wedding",
  title: "",
  city: "",
  eventDate: defaultEventDate(),
  guestCount: 80,
  budgetInr: 800000,
  vibe: "intimate",
  priorities: [...CATEGORIES],
  notes: "",
};

export function IntakeWizard({
  busy,
  error,
  onCreate,
}: {
  busy: boolean;
  error?: string;
  onCreate: (brief: EventBrief) => void;
}) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<EventBrief>(EMPTY);
  const [fieldError, setFieldError] = useState("");

  const update = (patch: Partial<EventBrief>) => setBrief((current) => ({ ...current, ...patch }));

  const movePriority = (index: number, direction: -1 | 1) => {
    const next = [...brief.priorities];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item as Category);
    update({ priorities: next });
  };

  const nextStep = () => {
    if (step === 0 && (brief.title.trim().length < 2 || brief.city.trim().length < 2)) {
      setFieldError("Add an event name and city of at least 2 characters.");
      return;
    }
    if (step === 1 && (!isRealIsoDate(brief.eventDate) || brief.guestCount < 1 || brief.budgetInr < 10000)) {
      setFieldError("Use a real calendar date, at least 1 guest, and a budget of ₹10,000 or more.");
      return;
    }
    setFieldError("");
    setStep((value) => value + 1);
  };

  const submit = () => {
    const parsed = eventBriefSchema.safeParse(brief);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Check the intake fields.");
      return;
    }
    setFieldError("");
    onCreate(parsed.data);
  };

  return (
    <form
      className="mx-auto max-w-2xl"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) nextStep();
        else submit();
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Step {step + 1} of 4</p>
      <h1 className="mt-3 font-serif text-5xl leading-[0.95]">Tell Marigold what this celebration has to hold.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The plan comes after these constraints. Gemini will draft it, and the totals stay in the app.
      </p>

      <div className="glass mt-8 space-y-4 rounded-[28px] p-6">
        {step === 0 ? (
          <>
            <Field label="Occasion">
              <select
                className={selectFieldClass()}
                value={brief.occasion}
                onChange={(event) => update({ occasion: event.target.value as Occasion })}
              >
                <option value="wedding">Wedding</option>
                <option value="birthday">Birthday</option>
                <option value="community">Community event</option>
              </select>
            </Field>
            <Field label="Event name" error={fieldError && brief.title.trim().length < 2 ? fieldError : undefined}>
              <TextInput
                value={brief.title}
                onChange={(event) => update({ title: event.target.value })}
                invalid={Boolean(fieldError) && brief.title.trim().length < 2}
                aria-describedby={fieldError ? "intake-error" : undefined}
                required
              />
            </Field>
            <Field label="City">
              <TextInput value={brief.city} onChange={(event) => update({ city: event.target.value })} required />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Event date">
              <TextInput type="date" value={brief.eventDate} onChange={(event) => update({ eventDate: event.target.value })} required />
            </Field>
            <Field label="Planning guest count">
              <TextInput
                type="number"
                min={1}
                value={brief.guestCount}
                onChange={(event) => update({ guestCount: Number(event.target.value) })}
                required
              />
            </Field>
            <Field label="Total budget (INR)" hint="Estimates will be labelled as assumptions, not vendor prices.">
              <TextInput
                type="number"
                min={10000}
                step={1000}
                value={brief.budgetInr}
                onChange={(event) => update({ budgetInr: Number(event.target.value) })}
                required
              />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="Vibe">
              <select
                className={selectFieldClass()}
                value={brief.vibe}
                onChange={(event) => update({ vibe: event.target.value as Vibe })}
              >
                <option value="intimate">Intimate</option>
                <option value="grand">Grand</option>
              </select>
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold">Priority order</legend>
              <p className="mt-1 text-sm text-muted-foreground">The first row is protected when the budget breaks.</p>
              <ol className="mt-3 space-y-2">
                {brief.priorities.map((category, index) => (
                  <li key={category} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
                    <span>
                      {index + 1}. {CATEGORY_LABELS[category]}
                    </span>
                    <span className="flex gap-2">
                      <Button type="button" variant="secondary" aria-label={`Move ${CATEGORY_LABELS[category]} up`} onClick={() => movePriority(index, -1)}>
                        Up
                      </Button>
                      <Button type="button" variant="secondary" aria-label={`Move ${CATEGORY_LABELS[category]} down`} onClick={() => movePriority(index, 1)}>
                        Down
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            </fieldset>
          </>
        ) : null}

        {step === 3 ? (
          <Field label="Constraints" hint="Dietary needs, access, indoor backup, or anything a vendor must know.">
            <TextArea value={brief.notes} maxLength={1000} onChange={(event) => update({ notes: event.target.value })} />
          </Field>
        ) : null}

        {fieldError ? (
          <p id="intake-error" className="text-sm font-medium text-danger" role="alert">
            {fieldError}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>
            Back
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Asking Gemini…" : step < 3 ? "Continue" : "Generate plan"}
        </Button>
      </div>
    </form>
  );
}
