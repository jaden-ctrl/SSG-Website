import "server-only";
import { Agent, run } from "@openai/agents";
import { partialAuditSchema, type Intake, type PartialAudit } from "@/lib/schemas";
import { SSG_BRAIN_INSTRUCTIONS } from "./instructions";

const auditAgent = new Agent({
  name: "SSGAI Business Diagnostician",
  model: process.env.SSGAI_MODEL || "gpt-5-mini",
  instructions: SSG_BRAIN_INSTRUCTIONS,
  outputType: partialAuditSchema,
});

export async function analyzeBusiness(intake: Intake): Promise<PartialAudit> {
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

