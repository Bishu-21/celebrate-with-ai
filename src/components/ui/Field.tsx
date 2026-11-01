import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      <span>{label}</span>
      {hint ? <span className="mt-1 block font-normal text-muted-foreground">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
      {error ? <span className="mt-1 block font-medium text-danger">{error}</span> : null}
    </label>
  );
}

export function textFieldClass(invalid = false): string {
  return cn(
    "min-h-11 w-full rounded-2xl border bg-surface px-3 text-base font-medium text-foreground placeholder:text-muted-foreground",
    invalid ? "border-danger" : "border-border",
  );
}

export function selectFieldClass(className?: string): string {
  return cn(textFieldClass(false), className);
}

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(textFieldClass(invalid), className)} aria-invalid={invalid || undefined} {...props} />;
}

export function TextArea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn(textFieldClass(invalid), "min-h-28 py-3", className)} aria-invalid={invalid || undefined} {...props} />;
}
