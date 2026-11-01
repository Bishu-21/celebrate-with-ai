import { NextResponse } from "next/server";
import { proposeTradeoffs } from "@/domain/budget";
import { applyTradeoffDraft } from "@/domain/merge-draft";
import type { EventPlan } from "@/domain/types";
import { recalculateBudgetTradeoffs } from "@/lib/gemini";
import { invalid, readBody } from "@/lib/http";
import { tradeoffRequestSchema } from "@/lib/schemas";

function localTradeoffs(plan: EventPlan) {
  return NextResponse.json({
    source: "local" as const,
    plan: {
      ...plan,
      source: "local" as const,
      tradeOffScenarios: proposeTradeoffs(plan.budgetBreakdown, plan.budgetInr, plan.priorities),
    },
    warning: "These trade-offs were calculated in the app. Gemini did not write them.",
  });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = tradeoffRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("The plan needs a valid budget before trade-offs can be calculated.");

  try {
    const draft = await recalculateBudgetTradeoffs(parsed.data.plan);
    const plan = applyTradeoffDraft(parsed.data.plan, draft);
    if (plan.tradeOffScenarios === parsed.data.plan.tradeOffScenarios) return localTradeoffs(parsed.data.plan);
    return NextResponse.json({ source: "gemini" as const, plan, warning: null });
  } catch {
    return localTradeoffs(parsed.data.plan);
  }
}
