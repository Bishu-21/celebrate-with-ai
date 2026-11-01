import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("glass rounded-[28px] p-5", className)}>{children}</article>;
}
