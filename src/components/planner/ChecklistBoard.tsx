"use client";

import { memo } from "react";
import type { ChecklistItem } from "@/domain/types";

export const ChecklistBoard = memo(function ChecklistBoard({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}) {
  const done = items.filter((item) => item.done).length;
  return (
    <section aria-labelledby="checklist-heading">
      <h2 id="checklist-heading" className="font-serif text-4xl">Checklist</h2>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {done} of {items.length} complete.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="glass flex min-h-12 items-center gap-3 rounded-2xl px-4">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(item.id)}
              />
              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.title}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
});
