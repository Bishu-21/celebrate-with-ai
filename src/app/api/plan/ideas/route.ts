import { NextResponse } from "next/server";
import { localIdeas } from "@/domain/ideas";
import { generateIdeas } from "@/lib/gemini";
import { invalid, readBody } from "@/lib/http";
import { eventPlanSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = eventPlanSchema.safeParse(body.data && typeof body.data === "object" && "plan" in body.data ? (body.data as { plan: unknown }).plan : null);
  if (!parsed.success) return invalid("Ideas need a valid plan.");

  const fallback = localIdeas(parsed.data);
  try {
    const drafted = await generateIdeas(parsed.data);
    const ideas = drafted.map((idea) => ({
      id: idea.id,
      title: idea.title,
      summary: idea.summary,
      occasion: parsed.data.occasion,
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
