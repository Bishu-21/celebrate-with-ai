"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const menuRef = useDialogFocus<HTMLDivElement>(open, close);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const links = LINKS.map((link) => (
    <a key={link.href} href={link.href} className="flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={close}>
      {link.label}
    </a>
  ));

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="glass mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full px-3 sm:px-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Marigold
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {links}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <Link href="/planner" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground sm:px-5">
            <span className="sm:hidden">Plan</span>
            <span className="hidden sm:inline">Open planner</span>
          </Link>
        </div>
      </div>
      {open ? (
        <div ref={menuRef} id="site-menu" role="dialog" aria-modal="true" aria-label="Site sections" className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={close} />
          <nav aria-label="Primary mobile" className="glass relative m-4 flex flex-col gap-1 rounded-[28px] p-4">
            {links}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
