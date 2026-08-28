import { z } from "zod";

export const atlasModeSchema = z.enum([
  "architect",
  "operator",
  "advisor",
  "reviewer",
]);

export const atlasPrioritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

export const atlasActionSchema = z.object({
  action: z.string().min(1),
  owner: z.enum(["atlas", "human", "future-agent"]),
  priority: atlasPrioritySchema,
  approvalRequired: z.boolean(),
  reason: z.string().min(1),
});

export const atlasResponseSchema = z.object({
  mode: atlasModeSchema,
  objective: z.string().min(1),
  assessment: z.string().min(1),
  recommendedDecision: z.string().min(1),
  rationale: z.array(z.string().min(1)).max(8),
  actions: z.array(atlasActionSchema).max(12),
  risks: z.array(z.string().min(1)).max(8),
  unknowns: z.array(z.string().min(1)).max(8),
  ownerApprovalRequired: z.boolean(),
  ownerApprovalReason: z.string(),
});

export const atlasRequestSchema = z.object({
  message: z.string().min(1).max(20_000),
  context: z.record(z.string(), z.unknown()).optional(),
  mode: atlasModeSchema.optional(),
  caseId: z.string().min(1).max(200).optional(),
  requestedBy: z.string().min(1).max(200).optional(),
});

export type AtlasRequest = z.infer<typeof atlasRequestSchema>;
export type AtlasResponse = z.infer<typeof atlasResponseSchema>;
