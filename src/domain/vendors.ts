import type { Category, VendorComparisonRow, VendorQuote } from "@/domain/types";

const HIDDEN_CHARGE_PATTERN = /\b(gst|tax|taxes|extra|overtime|hidden|additional|service charge|transport)\b/i;

export function hiddenChargeNotes(notes: string): string[] {
  return notes
    .split(/[.\n;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && HIDDEN_CHARGE_PATTERN.test(part));
}

export function mergeQuotes(existing: VendorQuote[], incoming: VendorQuote[]): VendorQuote[] {
  const replaced = new Set(incoming.map((quote) => quote.category));
  return [...existing.filter((quote) => !replaced.has(quote.category)), ...incoming];
}

export function compareVendorQuotes(
  quotes: VendorQuote[],
  headcountValue: number,
  capInrByCategory: Partial<Record<Category, number>>,
): VendorComparisonRow[] {
  return quotes.map((quote) => {
    const cap = capInrByCategory[quote.category];
    return {
      quoteId: quote.id,
      vendorName: quote.vendorName,
      category: quote.category,
      amountInr: quote.amountInr,
      guestCoverage: quote.guestCoverage,
      coversHeadcount: quote.guestCoverage >= headcountValue,
      withinCap: cap === undefined ? true : quote.amountInr <= cap,
      hiddenChargeNotes: hiddenChargeNotes(quote.notes),
      included: quote.included,
      isEstimated: quote.isEstimated,
    };
  });
}
