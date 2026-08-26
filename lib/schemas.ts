import { z } from "zod";

export const intakeSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200), company: z.string().trim().min(1).max(160),
  website: z.union([z.literal(""), z.string().url().max(300)]).optional().default(""),
  teamSize: z.enum(["1","2-10","11-50","51-200","201+"]),
  offer: z.string().trim().min(10).max(1200), challenge: z.string().trim().min(10).max(1600),
  attempts: z.string().trim().max(1200).optional().default(""), goal: z.string().trim().min(10).max(1200),
  revenueRange: z.enum(["Pre-revenue","Under $250K","$250K-$1M","$1M-$5M","$5M-$20M","$20M+","Prefer not to say"]),
  consent: z.literal("true"), faxNumber: z.string().max(0).optional().default(""),
});

export const auditFindingSchema = z.object({
  dimension: z.enum(["Strategy","Systems","Growth","Execution","Leadership"]), score: z.number().int().min(0).max(100),
  title: z.string().max(120), observation: z.string().max(600), recommendation: z.string().max(600),
});
export const partialAuditSchema = z.object({
  overallScore: z.number().int().min(0).max(100), executiveSummary: z.string().max(900),
  primaryConstraint: z.string().max(300), findings: z.array(auditFindingSchema).length(5),
  thirtyDayPriority: z.string().max(700), evidenceGaps: z.array(z.string().max(200)).min(1).max(5),
  confidence: z.enum(["low","medium","high"]), fullAuditOpportunity: z.string().max(500),
});
export type Intake = z.infer<typeof intakeSchema>;
export type PartialAudit = z.infer<typeof partialAuditSchema>;

