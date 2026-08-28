import "server-only";
import { Agent, run } from "@openai/agents";
import { ATLAS_BASE_INSTRUCTIONS } from "./instructions";
import { getAtlasBrainContext } from "./brain";
import { atlasResponseSchema, type AtlasRequest, type AtlasResponse } from "./schema";

function buildInstructions() {
  const brain = getAtlasBrainContext();
  const brainInstructions = brain.status === "loaded" && brain.instructions.trim()
    ? `\n\nSSG BRAIN CONTEXT\nVersion: ${brain.version}\nDocument ID: ${brain.documentId}\nCandidate ID: ${brain.candidateId}\nLifecycle status: ${brain.releaseStatus}\nAuthority scope: ${brain.authorityScope}\n\n${brain.instructions}`
    : "\n\nSSG BRAIN CONTEXT: not loaded yet.";

  return `${ATLAS_BASE_INSTRUCTIONS}${brainInstructions}`;
}

function createAtlasAgent() {
  return new Agent({
    name: "Atlas — SSG AI Architect",
    model: process.env.ATLAS_MODEL || "gpt-5.6",
    instructions: buildInstructions(),
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
    maxTurns: Number(process.env.ATLAS_MAX_TURNS || 6),
  });

  if (!result.finalOutput) throw new Error("Atlas returned no final output");
  return atlasResponseSchema.parse(result.finalOutput);
}
