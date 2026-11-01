import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const VARIANTS = {
  primary: "rounded-full bg-primary text-primary-foreground hover:bg-primary-dark",
  secondary: "rounded-full border border-border bg-surface text-foreground hover:bg-muted",
  ghost: "rounded-full text-foreground hover:bg-muted",
  danger: "rounded-full bg-danger-strong text-white hover:opacity-90",
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
