"use client";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { ReactNode } from "react";

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useDialogFocus<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="glass w-full max-w-lg rounded-[28px] p-6"
      >
        <h2 id="dialog-title" className="font-serif text-3xl">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        <div className="mt-4">
          <button type="button" className="min-h-11 rounded-full border border-border px-5 font-semibold" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
