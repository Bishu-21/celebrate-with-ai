import { cn } from "@/lib/cn";
import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const childDescribedBy = isValidElement<ControlProps>(children) ? children.props["aria-describedby"] : undefined;
  const describedBy = [hintId, errorId, childDescribedBy].filter(Boolean).join(" ") || undefined;
  const patch: ControlProps = { id, "aria-describedby": describedBy };
  if (error) patch["aria-invalid"] = true;
  const control = isValidElement<ControlProps>(children) ? cloneElement(children, patch) : children;

  return (
    <div className="block text-sm font-semibold text-foreground">
      <label htmlFor={id}>{label}</label>
      {hint ? <p id={hintId} className="mt-1 font-normal text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{control}</div>
      {error ? <p id={errorId} className="mt-1 font-medium text-danger" role="alert">{error}</p> : null}
    </div>
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

export function TextInput({ invalid, className, "aria-invalid": ariaInvalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(textFieldClass(invalid), className)} aria-invalid={ariaInvalid ?? (invalid || undefined)} {...props} />;
}

export function TextArea({ invalid, className, "aria-invalid": ariaInvalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn(textFieldClass(invalid), "min-h-28 py-3", className)} aria-invalid={ariaInvalid ?? (invalid || undefined)} {...props} />;
}
