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

export function headcount(guests: Guest[]): number {
  return guests
    .filter((guest) => guest.status === "yes" || guest.status === "maybe")
    .reduce((total, guest) => total + Math.max(0, guest.partySize), 0);
}

export function guestSummary(guests: Guest[]): { invited: number; yes: number; no: number; maybe: number; headcount: number } {
  return {
    invited: guests.filter((guest) => guest.status === "invited").length,
    yes: guests.filter((guest) => guest.status === "yes").length,
    no: guests.filter((guest) => guest.status === "no").length,
    maybe: guests.filter((guest) => guest.status === "maybe").length,
    headcount: headcount(guests),
  };
}
