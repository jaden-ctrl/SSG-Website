import { getStore } from "@netlify/blobs";
import {
  atlasApprovalSchema,
  atlasAuditEventSchema,
  atlasCaseSchema,
  atlasOutcomeSchema,
  atlasRunRecordSchema,
  type AtlasApproval,
  type AtlasAuditEvent,
  type AtlasCase,
  type AtlasOutcome,
  type AtlasRunRecord,
} from "./state";

const STORE_NAME = process.env.ATLAS_STATE_STORE || "atlas-runtime";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function now() {
  return new Date().toISOString();
}

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function caseKey(caseId: string) {
  return `cases/${safeKey(caseId)}.json`;
}

function runKey(runId: string) {
  return `runs/${safeKey(runId)}.json`;
}

function approvalKey(approvalId: string) {
  return `approvals/${safeKey(approvalId)}.json`;
}

function outcomeKey(outcomeId: string) {
  return `outcomes/${safeKey(outcomeId)}.json`;
}

function auditKey(event: AtlasAuditEvent) {
  return `audit/${safeKey(event.caseId)}/${event.occurredAt}-${safeKey(event.eventId)}.json`;
}

async function getJSON<T>(key: string): Promise<T | null> {
  return (await store().get(key, { type: "json", consistency: "strong" })) as T | null;
}

export async function getAtlasCase(caseId: string): Promise<AtlasCase | null> {
  const value = await getJSON<unknown>(caseKey(caseId));
  return value ? atlasCaseSchema.parse(value) : null;
}

export async function createAtlasCase(input: {
  caseId?: string;
  title: string;
  objective: string;
  createdBy: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<AtlasCase> {
  const timestamp = now();
  const value = atlasCaseSchema.parse({
    caseId: input.caseId || crypto.randomUUID(),
    title: input.title,
    objective: input.objective,
    status: "open",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.createdBy,
    currentRunId: null,
    tags: input.tags || [],
    metadata: input.metadata || {},
  });

  const write = await store().setJSON(caseKey(value.caseId), value, { onlyIfNew: true });
  if (!write.modified) throw new Error(`Atlas case already exists: ${value.caseId}`);
  return value;
}

export async function saveAtlasCase(value: AtlasCase): Promise<AtlasCase> {
  const parsed = atlasCaseSchema.parse({ ...value, updatedAt: now() });
  await store().setJSON(caseKey(parsed.caseId), parsed);
  return parsed;
}

export async function createAtlasRun(input: Omit<AtlasRunRecord, "runId" | "startedAt" | "completedAt" | "status" | "output" | "error">): Promise<AtlasRunRecord> {
  const value = atlasRunRecordSchema.parse({
    ...input,
    runId: crypto.randomUUID(),
    startedAt: now(),
    completedAt: null,
    status: "running",
    output: null,
    error: null,
  });

  const write = await store().setJSON(runKey(value.runId), value, { onlyIfNew: true });
  if (!write.modified) throw new Error(`Atlas run already exists: ${value.runId}`);
  return value;
}

export async function getAtlasRun(runId: string): Promise<AtlasRunRecord | null> {
  const value = await getJSON<unknown>(runKey(runId));
  return value ? atlasRunRecordSchema.parse(value) : null;
}

export async function completeAtlasRun(run: AtlasRunRecord, output: unknown): Promise<AtlasRunRecord> {
  const value = atlasRunRecordSchema.parse({
    ...run,
    status: "completed",
    completedAt: now(),
    output,
    error: null,
  });
  await store().setJSON(runKey(value.runId), value);
  return value;
}

export async function failAtlasRun(run: AtlasRunRecord, error: unknown): Promise<AtlasRunRecord> {
  const message = error instanceof Error ? error.message : "Unknown Atlas runtime failure";
  const value = atlasRunRecordSchema.parse({
    ...run,
    status: "failed",
    completedAt: now(),
    error: message.slice(0, 4_000),
  });
  await store().setJSON(runKey(value.runId), value);
  return value;
}

export async function createAtlasApproval(input: Omit<AtlasApproval, "approvalId" | "requestedAt" | "decidedAt" | "status" | "decidedBy" | "decisionNote">): Promise<AtlasApproval> {
  const value = atlasApprovalSchema.parse({
    ...input,
    approvalId: crypto.randomUUID(),
    requestedAt: now(),
    decidedAt: null,
    status: "pending",
    decidedBy: null,
    decisionNote: null,
  });
  await store().setJSON(approvalKey(value.approvalId), value, { onlyIfNew: true });
  return value;
}

export async function decideAtlasApproval(input: {
  approvalId: string;
  approved: boolean;
  decidedBy: string;
  decisionNote?: string;
}): Promise<AtlasApproval> {
  const existing = await getJSON<unknown>(approvalKey(input.approvalId));
  if (!existing) throw new Error(`Unknown Atlas approval: ${input.approvalId}`);
  const current = atlasApprovalSchema.parse(existing);
  if (current.status !== "pending") throw new Error(`Atlas approval already decided: ${input.approvalId}`);

  const value = atlasApprovalSchema.parse({
    ...current,
    status: input.approved ? "approved" : "denied",
    decidedAt: now(),
    decidedBy: input.decidedBy,
    decisionNote: input.decisionNote || null,
  });
  await store().setJSON(approvalKey(value.approvalId), value);
  return value;
}

export async function recordAtlasOutcome(input: Omit<AtlasOutcome, "outcomeId" | "recordedAt">): Promise<AtlasOutcome> {
  const value = atlasOutcomeSchema.parse({
    ...input,
    outcomeId: crypto.randomUUID(),
    recordedAt: now(),
  });
  await store().setJSON(outcomeKey(value.outcomeId), value, { onlyIfNew: true });
  return value;
}

export async function appendAtlasAuditEvent(input: Omit<AtlasAuditEvent, "eventId" | "occurredAt">): Promise<AtlasAuditEvent> {
  const value = atlasAuditEventSchema.parse({
    ...input,
    eventId: crypto.randomUUID(),
    occurredAt: now(),
  });
  await store().setJSON(auditKey(value), value, { onlyIfNew: true });
  return value;
}

export async function listAtlasAuditEvents(caseId: string): Promise<AtlasAuditEvent[]> {
  const prefix = `audit/${safeKey(caseId)}/`;
  const result = await store().list({ prefix });
  const events = await Promise.all(
    result.blobs.map(async (blob) => {
      const value = await getJSON<unknown>(blob.key);
      return value ? atlasAuditEventSchema.parse(value) : null;
    }),
  );
  return events.filter((event): event is AtlasAuditEvent => Boolean(event)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
