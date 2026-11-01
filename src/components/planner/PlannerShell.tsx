"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "vendors", label: "Vendors" },
  { id: "guests", label: "Guests" },
  { id: "checklist", label: "Checklist" },
  { id: "ideas", label: "Ideas" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export function PlannerShell({
  title,
  source,
  section,
  onSection,
  children,
}: {
  title: string;
  source: "gemini" | "local";
  section: SectionId;
  onSection: (section: SectionId) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const nav = (
    <nav aria-label="Plan sections" className="flex flex-1 flex-col gap-1 p-2">
      {SECTIONS.map((item, index) => {
        const current = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "flex min-h-11 items-center gap-3 rounded-full bg-primary px-3 text-left text-sm font-semibold text-primary-foreground"
                : "flex min-h-11 items-center gap-3 rounded-full px-3 text-left text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }
            onClick={() => {
              onSection(item.id);
              close();
            }}
          >
            <span className={current ? "font-serif text-base" : "font-serif text-base text-gold"}>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-72 shrink-0 p-4 md:block">
        <div className="glass sticky top-4 flex h-[calc(100dvh-2rem)] flex-col rounded-[32px] p-3">
          <Link href="/" className="block px-3 py-4 font-serif text-3xl">
            Marigold
          </Link>
          {nav}
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={close} />
          <aside className="glass relative h-full w-72 rounded-r-[32px] p-3">
            <p className="px-3 py-4 font-serif text-3xl">Marigold</p>
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="px-4 pt-4">
          <div className="glass mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Button className="md:hidden" variant="secondary" aria-label="Open plan menu" aria-expanded={open} onClick={() => setOpen(true)}>
                Menu
              </Button>
              <div className="min-w-0">
                <p className="truncate font-serif text-xl">{title}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">{source === "gemini" ? "Gemini draft" : "Local estimate"}</p>
              </div>
            </div>
            <Link href="/" className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              Home
            </Link>
          </div>
        </header>
        <main id="planner-main" className="flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
