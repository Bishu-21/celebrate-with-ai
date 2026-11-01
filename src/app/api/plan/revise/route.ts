import { NextResponse } from "next/server";
import { applyTradeoffDraft } from "@/domain/merge-draft";
import { isRealIsoDate } from "@/domain/money";
import { mergeConstraintDelta, parseConstraintChange, revisePlan } from "@/domain/revision";
import type { EventPlan } from "@/domain/types";
import { extractConstraintDelta, reviseEventPlan } from "@/lib/gemini";
import { invalid, readBody } from "@/lib/http";
import { reviseRequestSchema } from "@/lib/schemas";

function applyNotes(plan: EventPlan, timeline: { timelineTasks: Array<{ id: string; note: string }> } | null): EventPlan {
  if (!timeline) return plan;
  const notes = new Map(timeline.timelineTasks.map((task) => [task.id, task.note]));
  return {
    ...plan,
    timelineTasks: plan.timelineTasks.map((task) => (notes.has(task.id) ? { ...task, note: notes.get(task.id) ?? task.note } : task)),
  };
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = reviseRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("The current plan and the revision note need to be valid.");

  const today = parsed.data.today && isRealIsoDate(parsed.data.today) ? parsed.data.today : new Date().toISOString().slice(0, 10);
  let delta = parseConstraintChange(parsed.data.instruction, parsed.data.plan.budgetInr, parsed.data.plan.eventDate);
  try {
    delta = mergeConstraintDelta(delta, await extractConstraintDelta(parsed.data.plan, parsed.data.instruction));
  } catch {
    delta = mergeConstraintDelta(delta, null);
  }
  if (delta.ambiguous) return invalid(delta.ambiguous);
  const revised = revisePlan(parsed.data.plan, delta, today);
  if (!revised.changes.length && revised.warning) return invalid(revised.warning);

  const advisory = await reviseEventPlan(revised.plan, parsed.data.instruction);
  const withTradeoffs = advisory.tradeoffs ? applyTradeoffDraft(revised.plan, advisory.tradeoffs) : revised.plan;
  const plan = applyNotes(withTradeoffs, advisory.timeline);
  const geminiWrote = Boolean(advisory.tradeoffs || advisory.timeline);
  const warning = [
    revised.warning,
    geminiWrote ? null : "Numbers and dates were updated in the app. Gemini did not write the notes, so this revision is not a Gemini plan.",
  ].filter(Boolean).join(" ") || null;

  return NextResponse.json({
    source: geminiWrote ? "gemini" as const : "local" as const,
    plan: { ...plan, source: geminiWrote ? "gemini" as const : "local" as const },
    changes: revised.changes,
    warning,
    baseRevision: parsed.data.baseRevision ?? null,
  });
}
