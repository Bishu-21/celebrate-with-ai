import { NextResponse } from "next/server";
import { planFromDraft } from "@/domain/merge-draft";
import { generateInitialEventPlan } from "@/lib/gemini";
import { geminiFailure, invalid, readBody } from "@/lib/http";
import { generateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = generateRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("Check the occasion, date, guest count, and budget.");

  try {
    const draft = await generateInitialEventPlan(parsed.data.brief);
    const plan = planFromDraft(parsed.data.brief, draft);
    return NextResponse.json({ source: "gemini" as const, plan, warning: null });
  } catch (error) {
    return geminiFailure(error);
  }
}
