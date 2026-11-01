import type { EventPlan } from "@/domain/types";
import { eventPlanSchema } from "@/lib/schemas";
import { sanitizeUnknown } from "@/lib/sanitize";

const STORAGE_KEY = "marigold.plan.v2";
const LEGACY_KEY = "marigold.plan.v1";
const QUARANTINE_KEY = "marigold.plan.quarantine";

export type StorageResult =
  | { ok: true; plan: EventPlan | null; revision: number; migrated: boolean }
  | { ok: false; reason: "corrupt" | "quota" | "invalid" | "conflict"; message: string };

type Envelope = { schemaVersion: 2; revision: number; plan: EventPlan };

const listeners = new Set<() => void>();
let snapshot: EventPlan | null = null;
let snapshotRaw: string | null | undefined;
let revisionCache = 0;
let storageIssue: string | null = null;
let listening = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function parseEnvelope(raw: string): Envelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { schemaVersion?: unknown; revision?: unknown; plan?: unknown };
  if (record.schemaVersion !== 2 || typeof record.revision !== "number" || !Number.isInteger(record.revision)) return null;
  const plan = eventPlanSchema.safeParse(record.plan);
  if (!plan.success) return null;
  return { schemaVersion: 2, revision: record.revision, plan: plan.data };
}

function parseLegacy(raw: string): EventPlan | null {
  try {
    const plan = eventPlanSchema.safeParse(JSON.parse(raw) as unknown);
    return plan.success ? plan.data : null;
  } catch {
    return null;
  }
}

function quarantine(raw: string): void {
  try {
    window.localStorage.setItem(QUARANTINE_KEY, raw);
  } catch {
    storageIssue = "The saved plan could not be read, and the browser also refused a recovery copy.";
  }
}

function readStored(): StorageResult {
  if (typeof window === "undefined") return { ok: true, plan: null, revision: 0, migrated: false };
  const current = window.localStorage.getItem(STORAGE_KEY);
  if (current) {
    const envelope = parseEnvelope(current);
    if (!envelope) {
      quarantine(current);
      storageIssue = "The saved plan could not be read. The original text is still in this browser under a recovery copy.";
      return { ok: false, reason: "invalid", message: storageIssue };
    }
    storageIssue = null;
    return { ok: true, plan: envelope.plan, revision: envelope.revision, migrated: false };
  }
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (!legacy) {
    storageIssue = null;
    return { ok: true, plan: null, revision: 0, migrated: false };
  }
  const plan = parseLegacy(legacy);
  if (!plan) {
    quarantine(legacy);
    storageIssue = "An older saved plan could not be read. It was left in place.";
    return { ok: false, reason: "corrupt", message: storageIssue };
  }
  const saved = writeEnvelope({ schemaVersion: 2, revision: 1, plan });
  if (!saved.ok) return saved;
  storageIssue = null;
  return { ok: true, plan, revision: 1, migrated: true };
}

function writeEnvelope(envelope: Envelope): StorageResult {
  const raw = JSON.stringify(envelope);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    const message = "The browser refused to store the plan. Nothing new was saved.";
    storageIssue = message;
    return { ok: false, reason: "quota", message };
  }
  snapshot = envelope.plan;
  snapshotRaw = raw;
  revisionCache = envelope.revision;
  storageIssue = null;
  return { ok: true, plan: envelope.plan, revision: envelope.revision, migrated: false };
}

function ensureListener(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_KEY) return;
    snapshotRaw = undefined;
    emit();
  });
}

export function subscribePlan(listener: () => void): () => void {
  ensureListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStorageIssue(): string | null {
  return storageIssue;
}

export function getPlanRevision(): number {
  return revisionCache;
}

export function loadPlan(): EventPlan | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
  if (raw === snapshotRaw) return snapshot;
  const stored = readStored();
  if (!stored.ok) {
    snapshot = null;
    snapshotRaw = raw;
    revisionCache = 0;
    return snapshot;
  }
  snapshot = stored.plan;
  snapshotRaw = window.localStorage.getItem(STORAGE_KEY);
  revisionCache = stored.revision;
  return snapshot;
}

export function emptyPlan(): null {
  return null;
}

export function savePlan(plan: EventPlan, expectedRevision = revisionCache): StorageResult {
  if (typeof window === "undefined") return { ok: false, reason: "quota", message: "Storage is only available in the browser." };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  let storedRevision: number;
  if (raw !== null && raw === snapshotRaw) {
    storedRevision = revisionCache;
    if (storedRevision !== expectedRevision) {
      return { ok: false, reason: "conflict", message: "A newer copy of this plan is already saved in this browser." };
    }
  } else {
    const current = readStored();
    if (!current.ok && current.reason === "quota") return current;
    storedRevision = current.ok ? current.revision : 0;
    if (current.ok && storedRevision !== expectedRevision) {
      return { ok: false, reason: "conflict", message: "A newer copy of this plan is already saved in this browser." };
    }
  }
  const result = writeEnvelope({ schemaVersion: 2, revision: storedRevision + 1, plan: sanitizeUnknown(plan) as EventPlan });
  if (result.ok) emit();
  return result;
}

export function clearPlan(): void {
  snapshot = null;
  snapshotRaw = null;
  revisionCache = 0;
  storageIssue = null;
  window.localStorage.removeItem(STORAGE_KEY);
  emit();
}

export function refreshPlanFromStorage(): EventPlan | null {
  snapshotRaw = undefined;
  return loadPlan();
}
