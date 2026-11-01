"use client";

import { memo, useState } from "react";
import { guestSummary, isValidGuestEmail, isValidGuestName } from "@/domain/guests";
import type { Guest, GuestStatus } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { Field, selectFieldClass, TextInput } from "@/components/ui/Field";

export const GuestBoard = memo(function GuestBoard({
  guests,
  onAdd,
  onStatus,
  onApplyHeadcount,
}: {
  guests: Guest[];
  onAdd: (guest: Omit<Guest, "id">) => void;
  onStatus: (id: string, status: GuestStatus) => void;
  onApplyHeadcount: (headcountValue: number) => void;
}) {
  const summary = guestSummary(guests);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [mealNote, setMealNote] = useState("");
  const [error, setError] = useState("");

  return (
    <section aria-labelledby="guest-heading">
      <h2 id="guest-heading" className="font-serif text-4xl">Guests and RSVP</h2>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        RSVP headcount is {summary.headcount}. Yes {summary.yes}, maybe {summary.maybe}, no {summary.no}, waiting {summary.invited}.
      </p>
      <Button className="mt-3" variant="secondary" disabled={summary.headcount < 1} onClick={() => onApplyHeadcount(summary.headcount)}>
        Scale catering to the RSVP headcount
      </Button>
      <form
        className="glass mt-4 grid gap-3 rounded-[28px] p-5 md:grid-cols-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValidGuestName(name) || !isValidGuestEmail(email)) {
            setError("Use a name of 2 to 80 characters. Email can be blank, or a normal address.");
            return;
          }
          setError("");
          onAdd({ name: name.trim(), email: email.trim(), partySize, status: "invited", mealNote: mealNote.trim() });
          setName("");
          setEmail("");
          setMealNote("");
          setPartySize(1);
        }}
      >
        <Field label="Name">
          <TextInput autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email" hint="Optional.">
          <TextInput type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Party size">
          <TextInput type="number" min={1} max={20} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
        </Field>
        <Field label="Meal note">
          <TextInput value={mealNote} onChange={(event) => setMealNote(event.target.value)} />
        </Field>
        {error ? <p className="text-sm font-medium text-danger md:col-span-2" role="alert">{error}</p> : null}
        <Button type="submit">Add guest</Button>
      </form>
      <ul className="mt-4 space-y-2">
        {guests.map((guest) => (
          <li key={guest.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <span>
              <span className="font-semibold">{guest.name}</span>
              <span className="text-sm text-muted-foreground"> · party of {guest.partySize}{guest.mealNote ? ` · ${guest.mealNote}` : ""}</span>
            </span>
            <label className="text-sm font-semibold">
              <span className="sr-only">RSVP for {guest.name}</span>
              <select
                className={selectFieldClass("w-auto")}
                value={guest.status}
                onChange={(event) => onStatus(guest.id, event.target.value as GuestStatus)}
              >
                <option value="invited">Invited</option>
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
});
