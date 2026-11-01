import { NextResponse } from "next/server";
import { planFromDraft } from "@/domain/merge-draft";
import { generateInitialEventPlan } from "@/lib/gemini";
import { geminiFailure, readJson } from "@/lib/http";
import { generateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await readJson(request, generateRequestSchema, "Check the occasion, date, guest count, and budget.");
  if (!parsed.ok) return parsed.response;

  try {
    const draft = await generateInitialEventPlan(parsed.data.brief);
    const plan = planFromDraft(parsed.data.brief, draft);
    return NextResponse.json({ source: "gemini" as const, plan, warning: null });
  } catch (error) {
    return geminiFailure(error);
  }
}
