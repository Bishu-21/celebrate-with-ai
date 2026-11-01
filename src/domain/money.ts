import type { BudgetLine } from "@/domain/types";

const inrCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrInteger = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatInr(amountInr: number): string {
  return inrCurrency.format(Math.round(amountInr));
}

export function formatCount(amount: number): string {
  return inrInteger.format(Math.round(amount));
}

export function sumAmounts(lines: Pick<BudgetLine, "amountInr">[]): number {
  return lines.reduce((total, line) => total + line.amountInr, 0);
}

export function parseInrAmount(raw: string): number {
  const value = raw.trim().replace(/^(?:₹|INR|Rs\.?)\s*/i, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})$/.test(value)) return Number.NaN;
  const amount = Number(value.replaceAll(",", ""));
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

export function isRealIsoDate(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(isoDate: string, days: number): string {
  if (!isRealIsoDate(isoDate)) throw new Error("Invalid date.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error("Invalid date.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  const next = date.toISOString().slice(0, 10);
  if (!isRealIsoDate(next)) throw new Error("Invalid date.");
  return next;
}

export function daysBetween(earlier: string, later: string): number {
  if (!isRealIsoDate(earlier) || !isRealIsoDate(later)) throw new Error("Invalid date.");
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function compareIsoDates(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
