import { z } from "zod";

export const atlasCaseStatusSchema = z.enum([
  "open",
  "active",
  "waiting_approval",
  "blocked",
  "completed",
  "cancelled",
]);

export const atlasRunStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const atlasAuditEventTypeSchema = z.enum([
  "case.created",
  "case.updated",
  "run.started",
  "run.completed",
  "run.failed",
  "task.delegated",
  "task.completed",
  "task.failed",
  "approval.requested",
  "approval.granted",
  "approval.denied",
  "outcome.recorded",
  "learning.recorded",
  "system.error",
]);

export const atlasCaseSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  status: atlasCaseStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().min(1),
  currentRunId: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const atlasRunRecordSchema = z.object({
  runId: z.string().min(1),
  caseId: z.string().min(1),
  correlationId: z.string().min(1),
  requestedBy: z.string().min(1),
  mode: z.string().min(1),
  objective: z.string().min(1),
  status: atlasRunStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  brainVersion: z.string().min(1),
  brainCandidateId: z.string().min(1),
  brainLifecycleStatus: z.string().min(1),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
});

export const atlasApprovalSchema = z.object({
  approvalId: z.string().min(1),
  caseId: z.string().min(1),
  runId: z.string().min(1),
  action: z.string().min(1),
  reason: z.string().min(1),
  requestedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
  status: z.enum(["pending", "approved", "denied"]),
  decidedBy: z.string().nullable(),
  decisionNote: z.string().nullable(),
});

export const atlasOutcomeSchema = z.object({
  outcomeId: z.string().min(1),
  caseId: z.string().min(1),
  runId: z.string().nullable(),
  recordedAt: z.string().datetime(),
  recordedBy: z.string().min(1),
  outcome: z.enum(["success", "partial", "failure"]),
  summary: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  feedback: z.string().nullable(),
});

export const atlasAuditEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: atlasAuditEventTypeSchema,
  caseId: z.string().min(1),
  runId: z.string().nullable(),
  correlationId: z.string().min(1),
  actor: z.string().min(1),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type AtlasCase = z.infer<typeof atlasCaseSchema>;
export type AtlasRunRecord = z.infer<typeof atlasRunRecordSchema>;
export type AtlasApproval = z.infer<typeof atlasApprovalSchema>;
export type AtlasOutcome = z.infer<typeof atlasOutcomeSchema>;
export type AtlasAuditEvent = z.infer<typeof atlasAuditEventSchema>;
