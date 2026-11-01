import { NextResponse } from "next/server";
import { compareVendorQuotes as scoreQuotes, localVendorQuestions } from "@/domain/vendors";
import { compareVendorQuotes } from "@/lib/gemini";
import { invalid, readBody } from "@/lib/http";
import { vendorCompareRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return body.response;

  const parsed = vendorCompareRequestSchema.safeParse(body.data);
  if (!parsed.success) return invalid("Add at least two quotations with amounts and guest coverage.");

  const matrix = scoreQuotes(parsed.data.quotes, parsed.data.headcount, {
    [parsed.data.category]: parsed.data.capInr,
  });
  try {
    const draft = await compareVendorQuotes({
      category: parsed.data.category,
      mustHaves: parsed.data.mustHaves,
      guestCoverage: parsed.data.headcount,
      budgetCapInr: parsed.data.capInr,
      occasion: parsed.data.occasion,
      city: parsed.data.city,
      quotes: parsed.data.quotes.map((quote) => ({
        quoteId: quote.id,
        vendorName: quote.vendorName,
        amountInr: quote.amountInr,
        guestCoverage: quote.guestCoverage,
        included: quote.included,
        notes: quote.notes,
      })),
    });
    const commentary = matrix.map((row) => {
      const match = draft.vendorComparisonMatrix.find((item) => item.quoteId === row.quoteId)
        ?? draft.vendorComparisonMatrix.find((item) => item.vendorName === row.vendorName);
      return match
        ? {
            ...row,
            fitSummary: match.fitSummary,
            hiddenChargeNotes: match.hiddenChargeNotes.length ? match.hiddenChargeNotes : row.hiddenChargeNotes,
          }
        : row;
    });
    return NextResponse.json({
      source: "gemini" as const,
      vendorComparisonMatrix: commentary,
      commentary: draft.vendorComparisonMatrix,
      questions: draft.questions,
      warning: null,
    });
  } catch {
    return NextResponse.json({
      source: "local" as const,
      vendorComparisonMatrix: matrix,
      commentary: [],
      questions: localVendorQuestions({
        category: parsed.data.category,
        mustHaves: parsed.data.mustHaves,
        guestCoverage: parsed.data.headcount,
        city: parsed.data.city,
        occasion: parsed.data.occasion,
      }),
      warning: "Quote scores and questions were calculated in the app. Gemini did not write the commentary.",
    });
  }
}
