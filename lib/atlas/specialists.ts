import "server-only";
import { Agent } from "@openai/agents";
import { z } from "zod";
import { getAtlasBrainContext } from "./brain";

export const specialistOutputSchema = z.object({
  specialist: z.string().min(1),
  taskAssessment: z.string().min(1),
  findings: z.array(z.string().min(1)).max(10),
  recommendations: z.array(z.string().min(1)).max(10),
  evidenceNeeded: z.array(z.string().min(1)).max(8),
  risks: z.array(z.string().min(1)).max(8),
  confidence: z.enum(["high", "medium", "low"]),
  escalationRequired: z.boolean(),
  escalationReason: z.string(),
});

function governedSpecialistInstructions(role: string, purpose: string) {
  const brain = getAtlasBrainContext();
  return `You are ${role}, a subordinate specialist operating under Atlas for Shipley Solutions Group.

PURPOSE
${purpose}

BOUNDARIES
- You do not own the final user-facing decision; Atlas does.
- Execute only the bounded task supplied to you.
- Do not expand scope, grant yourself tools, create policy, redefine authority, or claim external actions occurred.
- Separate evidence, inference, assumptions, and unknowns.
- If evidence is missing, say what is needed rather than inventing facts.
- Escalate any consequential issue involving money, legal commitments, production changes, external communications, security/credentials, permissions, governance, or client-impacting irreversible action.
- Treat the task contract, allowed context, and tool grant as hard boundaries.

SSG BRAIN
Version: ${brain.version}
Status: ${brain.status}
${brain.instructions}

OUTPUT
Return only the required structured specialist result.`;
}

export const researchIntelligenceAgent = new Agent({
  name: "Atlas Specialist — Research & Intelligence",
  model: process.env.ATLAS_SPECIALIST_MODEL || process.env.ATLAS_MODEL || "gpt-5.6",
  instructions: governedSpecialistInstructions(
    "Research & Intelligence",
    "Gather, verify, synthesize, and challenge evidence required for Atlas decisions. Focus on provenance, uncertainty, contradictions, and missing evidence.",
  ),
  outputType: specialistOutputSchema,
});

export const growthSystemsAgent = new Agent({
  name: "Atlas Specialist — Growth Systems Architect",
  model: process.env.ATLAS_SPECIALIST_MODEL || process.env.ATLAS_MODEL || "gpt-5.6",
  instructions: governedSpecialistInstructions(
    "Growth Systems Architect",
    "Design acquisition, conversion, CRM, automation, retention, measurement, and operating-system improvements with clear dependencies and ROI logic.",
  ),
  outputType: specialistOutputSchema,
});

export const digitalDeliveryAgent = new Agent({
  name: "Atlas Specialist — Digital Delivery Architect",
  model: process.env.ATLAS_SPECIALIST_MODEL || process.env.ATLAS_MODEL || "gpt-5.6",
  instructions: governedSpecialistInstructions(
    "Digital Delivery Architect",
    "Plan and review websites, applications, integrations, deployment architecture, implementation sequencing, failure recovery, and technical delivery.",
  ),
  outputType: specialistOutputSchema,
});

export const qaAssuranceAgent = new Agent({
  name: "Atlas Specialist — QA & Assurance",
  model: process.env.ATLAS_SPECIALIST_MODEL || process.env.ATLAS_MODEL || "gpt-5.6",
  instructions: governedSpecialistInstructions(
    "QA & Assurance",
    "Independently challenge proposed outputs, test success criteria, identify defects and failure modes, verify evidence sufficiency, and recommend hold/release conditions.",
  ),
  outputType: specialistOutputSchema,
});

export const ATLAS_SPECIALIST_TOOLS = [
  researchIntelligenceAgent.asTool({
    toolName: "consult_research_intelligence",
    toolDescription: "Delegate a bounded evidence, research, verification, contradiction, or uncertainty-analysis task.",
  }),
  growthSystemsAgent.asTool({
    toolName: "consult_growth_systems_architect",
    toolDescription: "Delegate a bounded growth-system, CRM, automation, acquisition, conversion, retention, or measurement architecture task.",
  }),
  digitalDeliveryAgent.asTool({
    toolName: "consult_digital_delivery_architect",
    toolDescription: "Delegate a bounded website, application, integration, deployment, technical architecture, or implementation task.",
  }),
  qaAssuranceAgent.asTool({
    toolName: "consult_qa_assurance",
    toolDescription: "Delegate an independent quality, risk, defect, evidence-sufficiency, or release-readiness review.",
  }),
] as const;
