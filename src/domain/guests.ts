import type { Guest } from "@/domain/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGuestEmail(email: string): boolean {
  const value = email.trim();
  if (!value) return true;
  return value.length <= 120 && EMAIL_PATTERN.test(value);
}

export function isValidGuestName(name: string): boolean {
  const value = name.trim();
  return value.length >= 2 && value.length <= 80;
}

export function guestSummary(guests: Guest[]): { invited: number; yes: number; no: number; maybe: number; headcount: number } {
  const summary = { invited: 0, yes: 0, no: 0, maybe: 0, headcount: 0 };
  for (const guest of guests) {
    summary[guest.status] += 1;
    if (guest.status === "yes" || guest.status === "maybe") summary.headcount += Math.max(0, guest.partySize);
  }
  return summary;
}

export function headcount(guests: Guest[]): number {
  return guestSummary(guests).headcount;
}
