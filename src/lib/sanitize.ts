const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return value.replace(CONTROL_CHARS, "");
  if (Array.isArray(value)) return value.map(sanitizeUnknown);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const safeKey = key.replace(CONTROL_CHARS, "");
    if (!safeKey || DANGEROUS_KEYS.has(safeKey)) continue;
    next[safeKey] = sanitizeUnknown(item);
  }
  return next;
}

export function sanitizeMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
}
