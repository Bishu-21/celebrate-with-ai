import { NextResponse } from "next/server";
import { localVendorQuestions } from "@/domain/vendors";
import { compareVendorQuotes } from "@/lib/gemini";
import { readJson } from "@/lib/http";
import { vendorQuestionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await readJson(request, vendorQuestionRequestSchema, "Add the vendor category, city, and what the quote must cover.");
  if (!parsed.ok) return parsed.response;

  const local = () =>
    NextResponse.json({
      source: "local" as const,
      questions: localVendorQuestions(parsed.data),
      vendorComparisonMatrix: [],
      warning: "These questions were written in the app. Gemini did not write them.",
    });

  try {
    const draft = await compareVendorQuotes({ ...parsed.data, quotes: [] });
    if (!draft.questions.length) return local();
    return NextResponse.json({
      source: "gemini" as const,
      questions: draft.questions,
      vendorComparisonMatrix: draft.vendorComparisonMatrix,
      warning: null,
    });
  } catch {
    return local();
  }
}
