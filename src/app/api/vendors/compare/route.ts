import { NextResponse } from "next/server";
import { indexFirst } from "@/domain/index-first";
import { compareVendorQuotes as scoreQuotes, localVendorQuestions } from "@/domain/vendors";
import { compareVendorQuotes } from "@/lib/gemini";
import { readJson } from "@/lib/http";
import { vendorCompareRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = await readJson(request, vendorCompareRequestSchema, "Add at least two quotations with amounts and guest coverage.");
  if (!parsed.ok) return parsed.response;

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
    const byQuoteId = indexFirst(draft.vendorComparisonMatrix, (item) => item.quoteId);
    const byVendorName = indexFirst(draft.vendorComparisonMatrix, (item) => item.vendorName);
    const commentary = matrix.map((row) => {
      const match = byQuoteId.get(row.quoteId) ?? byVendorName.get(row.vendorName);
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
