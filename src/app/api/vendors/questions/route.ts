import { NextResponse } from "next/server";
import { compareVendorQuotes } from "@/lib/gemini";
import { geminiFailure, invalid, readBody } from "@/lib/http";
import { vendorQuestionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = vendorQuestionRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("Add the vendor category, city, and what the quote must cover.");

  try {
    const draft = await compareVendorQuotes({ ...parsed.data, quotes: [] });
    if (!draft.questions.length) {
      return NextResponse.json({ error: "Gemini did not return vendor questions." }, { status: 502 });
    }
    return NextResponse.json({
      source: "gemini" as const,
      questions: draft.questions,
      vendorComparisonMatrix: draft.vendorComparisonMatrix,
      warning: null,
    });
  } catch (error) {
    return geminiFailure(error);
  }
}
