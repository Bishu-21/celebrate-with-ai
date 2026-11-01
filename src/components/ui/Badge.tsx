import { cn } from "@/lib/cn";

export function Badge({
  tone,
  children,
}: {
  tone: "estimate" | "confirmed" | "over" | "ok" | "neutral";
  children: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
        tone === "estimate" && "bg-muted text-gold",
        tone === "confirmed" && "bg-sage text-white",
        tone === "over" && "bg-danger-strong text-white",
        tone === "ok" && "bg-sage text-white",
        tone === "neutral" && "bg-surface text-foreground",
      )}
    >
      {children}
    </span>
  );
}
