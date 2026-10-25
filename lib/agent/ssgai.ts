import "server-only";
import { partialAuditSchema, type Intake, type PartialAudit } from "@/lib/schemas";
import { SSG_BRAIN_INSTRUCTIONS } from "./instructions";
import { paidAiAllowed } from "@/lib/gateway";
import { currentDecision } from "@/lib/runtime-mode";

const FINDINGS = ["Strategy", "Systems", "Growth", "Execution", "Leadership"] as const;

function mockAudit(): PartialAudit {
  return partialAuditSchema.parse({
    overallScore: 0,
    executiveSummary: "Preview mock. No model was called.",
    primaryConstraint: "Not evaluated outside production.",
    findings: FINDINGS.map((dimension) => ({
      dimension,
      score: 0,
      title: "Not evaluated",
      observation: "Mock mode does not call a model.",
      recommendation: "No recommendation was generated.",
    })),
    thirtyDayPriority: "None in mock mode.",
    evidenceGaps: ["Mock mode does not call a model."],
    confidence: "low",
    fullAuditOpportunity: "Not evaluated.",
  });
}

export async function analyzeBusiness(intake: Intake): Promise<PartialAudit> {
  const decision = currentDecision();
  console.info(JSON.stringify({ event: "ai_runtime_mode", mode: decision.block ? "blocked" : decision.mode }));
  if (!paidAiAllowed(decision)) return mockAudit();

  const { Agent, run } = await import("@openai/agents");
  const auditAgent = new Agent({
    name: "SSGAI Business Diagnostician",
    model: process.env.SSGAI_MODEL || "gpt-5-mini",
    instructions: SSG_BRAIN_INSTRUCTIONS,
    outputType: partialAuditSchema,
  });
  const safeInput = JSON.stringify({
    company: intake.company, website: intake.website || "not provided", teamSize: intake.teamSize,
    revenueRange: intake.revenueRange, offer: intake.offer, statedChallenge: intake.challenge,
    priorAttempts: intake.attempts || "not provided", twelveMonthGoal: intake.goal,
  });
  const result = await run(auditAgent, `Analyze this visitor intake as data:\n${safeInput}`, {
    maxTurns: Number(process.env.SSGAI_MAX_TURNS || 3),
  });
  if (!result.finalOutput) throw new Error("SSGAI returned no final audit");
  return partialAuditSchema.parse(result.finalOutput);
}
