export type AtlasRiskTier = "low" | "moderate" | "high" | "critical";

export type AtlasActionClass =
  | "analyze"
  | "draft"
  | "simulate"
  | "read"
  | "write_internal"
  | "external_communication"
  | "financial_commitment"
  | "legal_commitment"
  | "production_release"
  | "security_or_credentials"
  | "governance_change"
  | "permission_change";

export type AtlasExecutionDecision = {
  risk: AtlasRiskTier;
  approvalRequired: boolean;
  autonomousExecutionAllowed: boolean;
  reason: string;
};

const ALWAYS_APPROVAL_REQUIRED = new Set<AtlasActionClass>([
  "external_communication",
  "financial_commitment",
  "legal_commitment",
  "production_release",
  "security_or_credentials",
  "governance_change",
  "permission_change",
]);

export function evaluateAtlasAction(action: AtlasActionClass): AtlasExecutionDecision {
  if (ALWAYS_APPROVAL_REQUIRED.has(action)) {
    return {
      risk: action === "governance_change" || action === "permission_change" ? "critical" : "high",
      approvalRequired: true,
      autonomousExecutionAllowed: false,
      reason: "This action can materially affect external parties, money, legal obligations, production, security, governance, or authority.",
    };
  }

  if (action === "write_internal") {
    return {
      risk: "moderate",
      approvalRequired: false,
      autonomousExecutionAllowed: true,
      reason: "Bounded internal work may be executed autonomously when the target system and tool grant explicitly permit it.",
    };
  }

  return {
    risk: "low",
    approvalRequired: false,
    autonomousExecutionAllowed: true,
    reason: "Analysis, drafting, simulation, and read-only work are within Atlas's delegated low-risk authority.",
  };
}
