import { Agent, run } from "@openai/agents";
import { ATLAS_BASE_INSTRUCTIONS } from "./instructions";
import { getAtlasBrainContext } from "./brain";
import { atlasResponseSchema, type AtlasRequest, type AtlasResponse } from "./schema";
import { delegateSpecialistTask } from "./delegation";
import { withAtlasRuntimeContext } from "./runtime-context";
import {
  appendAtlasAuditEvent,
  completeAtlasRun,
  createAtlasApproval,
  createAtlasCase,
  createAtlasRun,
  failAtlasRun,
  getAtlasCase,
  saveAtlasCase,
} from "./store";

export function buildAtlasInstructions() {
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
    instructions: buildAtlasInstructions(),
    tools: [delegateSpecialistTask],
    outputType: atlasResponseSchema,
  });
}

export type AtlasRunResult = {
  runtime: {
    caseId: string;
    runId: string;
    correlationId: string;
    approvalId: string | null;
    state: "active" | "waiting_approval";
  };
  output: AtlasResponse;
};

export async function runAtlas(request: AtlasRequest): Promise<AtlasRunResult> {
  const atlas = createAtlasAgent();
  const brain = getAtlasBrainContext();
  const requestedBy = request.requestedBy || "internal-owner";
  const correlationId = crypto.randomUUID();

  let atlasCase = request.caseId ? await getAtlasCase(request.caseId) : null;
  if (!atlasCase) {
    atlasCase = await createAtlasCase({
      caseId: request.caseId,
      title: request.message.slice(0, 120),
      objective: request.message,
      createdBy: requestedBy,
      metadata: { source: "atlas-api" },
    });
    await appendAtlasAuditEvent({
      eventType: "case.created",
      caseId: atlasCase.caseId,
      runId: null,
      correlationId,
      actor: requestedBy,
      payload: { objective: atlasCase.objective },
    });
  }

  const runRecord = await createAtlasRun({
    caseId: atlasCase.caseId,
    correlationId,
    requestedBy,
    mode: request.mode || "architect",
    objective: request.message,
    brainVersion: brain.version,
    brainCandidateId: brain.candidateId,
    brainLifecycleStatus: brain.releaseStatus,
  });

  atlasCase = await saveAtlasCase({ ...atlasCase, status: "active", currentRunId: runRecord.runId });
  await appendAtlasAuditEvent({
    eventType: "run.started",
    caseId: atlasCase.caseId,
    runId: runRecord.runId,
    correlationId,
    actor: requestedBy,
    payload: {
      mode: request.mode || "architect",
      brainVersion: brain.version,
      brainCandidateId: brain.candidateId,
      brainLifecycleStatus: brain.releaseStatus,
    },
  });

  const input = JSON.stringify({
    requestedMode: request.mode || "architect",
    objective: request.message,
    suppliedContext: request.context || {},
    runtimeContext: {
      caseId: atlasCase.caseId,
      runId: runRecord.runId,
      correlationId,
    },
    governingBrain: {
      version: brain.version,
      documentId: brain.documentId,
      candidateId: brain.candidateId,
      lifecycleStatus: brain.releaseStatus,
      authorityScope: brain.authorityScope,
    },
  });

  try {
    const result = await withAtlasRuntimeContext(
      { caseId: atlasCase.caseId, runId: runRecord.runId, correlationId, requestedBy },
      () => run(atlas, `Process this Atlas operating request as structured data:\n${input}`, {
        maxTurns: Number(process.env.ATLAS_MAX_TURNS || 10),
      }),
    );

    if (!result.finalOutput) throw new Error("Atlas returned no final output");
    const output = atlasResponseSchema.parse(result.finalOutput);
    await completeAtlasRun(runRecord, output);

    let approvalId: string | null = null;
    if (output.ownerApprovalRequired) {
      const approval = await createAtlasApproval({
        caseId: atlasCase.caseId,
        runId: runRecord.runId,
        action: output.recommendedDecision,
        reason: output.ownerApprovalReason || "Atlas marked this decision as requiring owner approval.",
      });
      approvalId = approval.approvalId;
      atlasCase = await saveAtlasCase({ ...atlasCase, status: "waiting_approval", currentRunId: runRecord.runId });
      await appendAtlasAuditEvent({
        eventType: "approval.requested",
        caseId: atlasCase.caseId,
        runId: runRecord.runId,
        correlationId,
        actor: "atlas",
        payload: { approvalId, action: approval.action, reason: approval.reason },
      });
    } else {
      atlasCase = await saveAtlasCase({ ...atlasCase, status: "active", currentRunId: runRecord.runId });
    }

    await appendAtlasAuditEvent({
      eventType: "run.completed",
      caseId: atlasCase.caseId,
      runId: runRecord.runId,
      correlationId,
      actor: "atlas",
      payload: {
        ownerApprovalRequired: output.ownerApprovalRequired,
        recommendedDecision: output.recommendedDecision,
      },
    });

    return {
      runtime: {
        caseId: atlasCase.caseId,
        runId: runRecord.runId,
        correlationId,
        approvalId,
        state: output.ownerApprovalRequired ? "waiting_approval" : "active",
      },
      output,
    };
  } catch (error) {
    await failAtlasRun(runRecord, error);
    atlasCase = await saveAtlasCase({ ...atlasCase, status: "blocked", currentRunId: runRecord.runId });
    await appendAtlasAuditEvent({
      eventType: "run.failed",
      caseId: atlasCase.caseId,
      runId: runRecord.runId,
      correlationId,
      actor: "atlas-runtime",
      payload: { error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown Atlas runtime failure" },
    });
    throw error;
  }
}
