"use client";

import { memo } from "react";
import { CATEGORY_LABELS } from "@/domain/types";
import type { EventPlan, TaskStatus, TimelineTask } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const TaskRow = memo(function TaskRow({
  task,
  onStatus,
}: {
  task: TimelineTask;
  onStatus: (id: string, status: TaskStatus) => void;
}) {
  return (
    <li className="glass rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">{task.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Due {task.dueDate}. {task.durationDays} days. {task.ownerHint}.
            {task.dependencies.length ? ` Depends on ${task.dependencies.join(", ")}.` : " No earlier dependency."}
          </p>
          {task.note ? <p className="mt-2 text-sm">{task.note}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {task.overdue ? <Badge tone="over">Overdue</Badge> : null}
          <Badge tone={task.status === "done" ? "ok" : task.status === "blocked" ? "over" : "neutral"}>{task.status}</Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["todo", "doing", "done"] as TaskStatus[]).map((status) => (
          <Button key={status} variant={task.status === status ? "primary" : "secondary"} aria-pressed={task.status === status} aria-label={`Set ${task.title} to ${status}`} onClick={() => onStatus(task.id, status)}>
            {status}
          </Button>
        ))}
      </div>
    </li>
  );
});

export const TimelineBoard = memo(function TimelineBoard({
  plan,
  busy,
  onStatus,
  onReschedule,
  onDateChange,
  warnings = [],
}: {
  plan: EventPlan;
  busy: boolean;
  onStatus: (id: string, status: TaskStatus) => void;
  onReschedule: () => void;
  onDateChange: (eventDate: string) => void;
  warnings?: string[];
}) {
  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="timeline-heading" className="font-serif text-4xl">Timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Due dates are calculated from dependencies. Gemini only rewrites notes.</p>
          <label className="mt-3 block text-sm font-semibold" htmlFor="event-date">Event date</label>
          <input
            id="event-date"
            className="mt-1 rounded-full border border-border bg-background px-4 py-2"
            type="date"
            value={plan.eventDate}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={onReschedule} disabled={busy}>
          {busy ? "Asking Gemini…" : "Ask Gemini to reschedule notes"}
        </Button>
      </div>
      {warnings.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gold" role="status">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <ol className="mt-4 space-y-3">
        {plan.timelineTasks.map((task) => (
          <TaskRow key={task.id} task={task} onStatus={onStatus} />
        ))}
      </ol>
      <p className="sr-only">Protected categories start with {CATEGORY_LABELS[plan.priorities[0] ?? "catering"]}.</p>
    </section>
  );
});
