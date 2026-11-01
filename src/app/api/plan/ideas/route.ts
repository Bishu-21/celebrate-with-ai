import { NextResponse } from "next/server";
import { localIdeas } from "@/domain/ideas";
import { generateIdeas } from "@/lib/gemini";
import { readJson } from "@/lib/http";
import { ideasRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await readJson(request, ideasRequestSchema, "Ideas need a valid plan.");
  if (!parsed.ok) return parsed.response;

  const plan = parsed.data.plan;
  const fallback = localIdeas(plan);
  try {
    const drafted = await generateIdeas(plan);
    const ideas = drafted.map((idea) => ({
      id: idea.id,
      title: idea.title,
      summary: idea.summary,
      occasion: plan.occasion,
      estimatedCostInr: idea.estimatedCostInr,
      taskTitle: idea.taskTitle || null,
      status: "suggested" as const,
      source: "gemini" as const,
    }));
    return NextResponse.json({ source: "gemini" as const, ideas, warning: null });
  } catch {
    return NextResponse.json({
      source: "local" as const,
      ideas: fallback,
      warning: "These ideas come from occasion templates in the app. Gemini did not write them.",
    });
  }
}
