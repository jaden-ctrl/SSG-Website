export const SSG_BRAIN_BASELINE = {
  documentId: "SSG-BRAIN-020",
  candidateId: "SSG-BRAIN-020-E1-R0-WC1",
  portfolioLabel: "v2.0",
  status: "WORKING_CANDIDATE",
  classification: "INTERNAL_RESTRICTED",
} as const;

export const SSGAI_AGENT_RELEASE = {
  agentId: "SSGAI-FREE-AUDIT",
  releaseId: process.env.SSGAI_AGENT_RELEASE_ID || "ssgai-free-audit-dev-1",
  taskContractId: "SSGAI-TASK-FREE-PREVIEW-1",
  workflowVersion: "free-audit-case-v1",
  outputSchemaVersion: "partial-audit-v2",
  autonomyTier: "A1_DRAFT_ONLY",
  externalEffects: "PROHIBITED_UNTIL_HUMAN_RELEASE",
} as const;

