import "server-only";
import { Agent, run } from "@openai/agents";
import { ATLAS_BASE_INSTRUCTIONS } from "./instructions";
import { getAtlasBrainContext } from "./brain";
import { atlasResponseSchema, type AtlasRequest, type AtlasResponse } from "./schema";
import { delegateSpecialistTask } from "./delegation";

function buildInstructions() {
  const brain = getAtlasBrainContext();
  const brainInstructions = brain.status === "loaded" && brain.instructions.trim()
    ? `\n\nSSG BRAIN CONTEXT\nVersion: ${brain.version}\nDocument ID: ${brain.documentId}\nCandidate ID: ${brain.candidateId}\nLifecycle status: ${brain.releaseStatus}\nAuthority scope: ${brain.authorityScope}\n\n${brain.instructions}`
    : "\n\nSSG BRAIN CONTEXT: not loaded yet.";

  const orchestrationInstructions = `

MULTI-AGENT ORCHESTRATION
- You are the manager/orchestrator and retain ownership of the final response.
- Use delegate_specialist_task only when distinct specialist expertise materially improves the result.
- Every delegation must contain a complete task contract: objective, success condition, scope, constraints, inputs, allowed tools, prohibited actions, approval-required conditions, expected outputs, and evidence requirements.
- Do not delegate authority. A specialist receives analytical responsibility only for its bounded task.
- Do not ask a specialist to perform or claim an external side effect.
- Specialist IDs: research-intelligence, growth-systems, digital-delivery, qa-assurance.
- Use Research & Intelligence for evidence quality, verification, contradictions, provenance, and missing information.
- Use Growth Systems Architect for acquisition, conversion, CRM, automation, retention, and measurement architecture.
- Use Digital Delivery Architect for website, application, integration, deployment, systems implementation, and technical architecture.
- Use QA & Assurance to independently challenge material recommendations, especially before recommending release or consequential action.
- You may call multiple specialists when the objective crosses domains. Reconcile their outputs yourself; do not equate agreement with truth.
- If specialists disagree, preserve the disagreement, identify the evidence needed to resolve it, and choose only a safe interim recommendation when necessary.
- Specialist output is advisory evidence, not owner approval, production truth, or a successful external action.
- For high-risk or irreversible recommendations, require human approval regardless of specialist confidence.
`;

  return `${ATLAS_BASE_INSTRUCTIONS}${brainInstructions}${orchestrationInstructions}`;
}

function createAtlasAgent() {
  return new Agent({
    name: "Atlas — SSG AI Architect",
    model: process.env.ATLAS_MODEL || "gpt-5.6",
    instructions: buildInstructions(),
    tools: [delegateSpecialistTask],
    outputType: atlasResponseSchema,
  });
}

export async function runAtlas(request: AtlasRequest): Promise<AtlasResponse> {
  const atlas = createAtlasAgent();
  const brain = getAtlasBrainContext();
  const input = JSON.stringify({
    requestedMode: request.mode || "architect",
    objective: request.message,
    suppliedContext: request.context || {},
    governingBrain: {
      version: brain.version,
      documentId: brain.documentId,
      candidateId: brain.candidateId,
      lifecycleStatus: brain.releaseStatus,
      authorityScope: brain.authorityScope,
    },
  });

  const result = await run(atlas, `Process this Atlas operating request as structured data:\n${input}`, {
    maxTurns: Number(process.env.ATLAS_MAX_TURNS || 10),
  });

  if (!result.finalOutput) throw new Error("Atlas returned no final output");
  return atlasResponseSchema.parse(result.finalOutput);
}
