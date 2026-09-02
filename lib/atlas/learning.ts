export type AtlasLearningEvidence = {
  taskId: string;
  outcome: "success" | "partial" | "failure";
  feedback?: string;
  qaFindings?: string[];
  failureModes?: string[];
  successfulStrategies?: string[];
  toolPerformance?: Record<string, number>;
};

export type AtlasImprovementProposal = {
  target: "working_memory" | "operational_knowledge" | "routing" | "evaluation" | "workflow" | "prompt_or_model" | "governance";
  proposal: string;
  evidence: AtlasLearningEvidence[];
  productionPromotionAllowed: boolean;
  ownerApprovalRequired: boolean;
};

export function classifyAtlasImprovement(
  target: AtlasImprovementProposal["target"],
): Pick<AtlasImprovementProposal, "productionPromotionAllowed" | "ownerApprovalRequired"> {
  if (target === "working_memory" || target === "operational_knowledge") {
    return { productionPromotionAllowed: true, ownerApprovalRequired: false };
  }

  // Atlas may propose and test these changes, but cannot silently promote them.
  return { productionPromotionAllowed: false, ownerApprovalRequired: true };
}
