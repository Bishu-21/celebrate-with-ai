import { NextResponse } from "next/server";
import { applyTimelineDraft } from "@/domain/merge-draft";
import { isRealIsoDate } from "@/domain/money";
import { scheduleTasks, validateTaskGraph } from "@/domain/timeline";
import { rescheduleTimelineWithDependencies } from "@/lib/gemini";
import { invalid, readBody } from "@/lib/http";
import { timelineRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = timelineRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("Choose a valid event date.");

  const today = parsed.data.today && isRealIsoDate(parsed.data.today) ? parsed.data.today : new Date().toISOString().slice(0, 10);
  const graphWarnings = validateTaskGraph(parsed.data.plan.timelineTasks, parsed.data.eventDate, today);

  try {
    const draft = await rescheduleTimelineWithDependencies(
      { ...parsed.data.plan, eventDate: parsed.data.eventDate },
      parsed.data.eventDate,
    );
    const plan = applyTimelineDraft(parsed.data.plan, draft, parsed.data.eventDate, today);
    return NextResponse.json({
      source: "gemini" as const,
      plan,
      warning: graphWarnings.length ? graphWarnings.join(" ") : null,
    });
  } catch {
    const done = new Set(parsed.data.plan.timelineTasks.filter((task) => task.status === "done").map((task) => task.id));
    const timelineTasks = scheduleTasks(parsed.data.plan.timelineTasks, parsed.data.eventDate, today).map((task) =>
      done.has(task.id) ? { ...task, status: "done" as const, overdue: false } : task,
    );
    return NextResponse.json({
      source: "local" as const,
      plan: { ...parsed.data.plan, source: "local" as const, eventDate: parsed.data.eventDate, timelineTasks },
      warning: ["Due dates were recalculated in the app. Gemini did not rewrite the notes.", ...graphWarnings].join(" "),
    });
  }
}
