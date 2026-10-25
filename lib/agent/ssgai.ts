import "server-only";
import { partialAuditSchema, type Intake, type PartialAudit } from "@/lib/schemas";
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

/** Preview mock only. The live Agents SDK path was removed with the revoked OpenAI key. */
export async function analyzeBusiness(_intake: Intake): Promise<PartialAudit> {
  const decision = currentDecision();
  console.info(JSON.stringify({ event: "ai_runtime_mode", mode: decision.block ? "blocked" : decision.mode }));
  return mockAudit();
}
