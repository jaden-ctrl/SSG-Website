import "server-only";
import { Agent, run } from "@openai/agents";
import { ATLAS_BASE_INSTRUCTIONS } from "./instructions";
import { getAtlasBrainContext } from "./brain";
import { atlasResponseSchema, type AtlasRequest, type AtlasResponse } from "./schema";

function buildInstructions() {
  const brain = getAtlasBrainContext();
  const brainInstructions = brain.status === "loaded" && brain.instructions.trim()
    ? `\n\nAUTHORITATIVE SSG BRAIN (${brain.version})\n${brain.instructions}`
    : "\n\nAUTHORITATIVE SSG BRAIN: not loaded yet.";

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
  const input = JSON.stringify({
    requestedMode: request.mode || "architect",
    objective: request.message,
    suppliedContext: request.context || {},
  });

  const result = await run(atlas, `Process this Atlas operating request as structured data:\n${input}`, {
    maxTurns: Number(process.env.ATLAS_MAX_TURNS || 6),
  });

  if (!result.finalOutput) throw new Error("Atlas returned no final output");
  return atlasResponseSchema.parse(result.finalOutput);
}
