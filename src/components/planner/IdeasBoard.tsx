"use client";

import { formatInr } from "@/domain/money";
import type { PersonalizedIdea } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function IdeasBoard({
  ideas,
  busy,
  warning,
  onSuggest,
  onStatus,
  onAdd,
}: {
  ideas: PersonalizedIdea[];
  busy: boolean;
  warning: string | null;
  onSuggest: () => void;
  onStatus: (ideaId: string, status: PersonalizedIdea["status"]) => void;
  onAdd: (ideaId: string) => void;
}) {
  return (
    <section aria-labelledby="ideas-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ideas-heading" className="font-serif text-4xl">Ideas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Suggestions follow the occasion. Adding one is a separate step and shows the cost before it changes the plan.
          </p>
        </div>
        <Button variant="secondary" onClick={onSuggest} disabled={busy}>
          {busy ? "Asking Gemini…" : "Suggest ideas"}
        </Button>
      </div>
      {warning ? <p className="mt-4 text-sm text-gold" role="status">{warning}</p> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {ideas.filter((idea) => idea.status !== "dismissed").map((idea) => (
          <article key={idea.id} className="glass rounded-[28px] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-2xl">{idea.title}</h3>
              <Badge tone={idea.source === "gemini" ? "estimate" : "neutral"}>{idea.source === "gemini" ? "Gemini" : "Local template"}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{idea.summary}</p>
            <p className="mt-2 text-sm">Estimated add {formatInr(idea.estimatedCostInr)}. {idea.taskTitle ? `Task: ${idea.taskTitle}.` : "No new task."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {idea.status !== "saved" && idea.status !== "added" ? (
                <Button variant="secondary" aria-label={`Save ${idea.title}`} onClick={() => onStatus(idea.id, "saved")}>Save</Button>
              ) : null}
              {idea.status !== "added" ? (
                <Button variant="secondary" aria-label={`Dismiss ${idea.title}`} onClick={() => onStatus(idea.id, "dismissed")}>Dismiss</Button>
              ) : null}
              {idea.status !== "added" ? (
                <Button aria-label={`Add ${idea.title} to plan`} onClick={() => onAdd(idea.id)}>Add to plan</Button>
              ) : (
                <Badge tone="ok">Added</Badge>
              )}
            </div>
          </article>
        ))}
      </div>
      {!ideas.length ? <p className="mt-4 text-sm text-muted-foreground">No ideas yet. Ask for suggestions for this occasion.</p> : null}
    </section>
  );
}
