import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAtlasAction } from "../lib/atlas/governance";
import { atlasTaskContractSchema } from "../lib/atlas/task-contract";
import { atlasCaseSchema, atlasRunRecordSchema } from "../lib/atlas/state";
import { classifyAtlasImprovement } from "../lib/atlas/learning";

test("consequential actions always require approval", () => {
  for (const action of [
    "external_communication",
    "financial_commitment",
    "legal_commitment",
    "production_release",
    "security_or_credentials",
    "governance_change",
    "permission_change",
  ] as const) {
    const decision = evaluateAtlasAction(action);
    assert.equal(decision.approvalRequired, true, action);
    assert.equal(decision.autonomousExecutionAllowed, false, action);
  }
});

test("low-risk analysis remains autonomous", () => {
  const decision = evaluateAtlasAction("analyze");
  assert.equal(decision.risk, "low");
  assert.equal(decision.approvalRequired, false);
  assert.equal(decision.autonomousExecutionAllowed, true);
});

test("task contract rejects incomplete delegation", () => {
  const result = atlasTaskContractSchema.safeParse({
    taskId: "t-1",
    objective: "Review the proposed release",
  });
  assert.equal(result.success, false);
});

test("task contract accepts explicit bounded delegation", () => {
  const result = atlasTaskContractSchema.safeParse({
    taskId: "t-2",
    objective: "Review the proposed release",
    successCondition: "Return material defects and hold/release criteria",
    scope: ["release candidate"],
    constraints: ["no production changes"],
    inputs: [{ key: "candidate", value: "atlas-agent-v1" }],
    allowedTools: ["read"],
    prohibitedActions: ["production_release"],
    approvalRequiredFor: ["production_release"],
    expectedOutputs: ["qa findings"],
    evidenceRequired: ["test evidence"],
    parentTaskId: null,
  });
  assert.equal(result.success, true);
});

test("state schemas preserve durable runtime identity", () => {
  const timestamp = new Date().toISOString();
  const atlasCase = atlasCaseSchema.parse({
    caseId: "case-1",
    title: "Verification case",
    objective: "Verify Atlas runtime",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "owner",
    currentRunId: "run-1",
    tags: [],
    metadata: {},
  });

  const run = atlasRunRecordSchema.parse({
    runId: "run-1",
    caseId: atlasCase.caseId,
    correlationId: "corr-1",
    requestedBy: "owner",
    mode: "architect",
    objective: atlasCase.objective,
    status: "running",
    startedAt: timestamp,
    completedAt: null,
    brainVersion: "SSG Brain v2.0",
    brainCandidateId: "candidate-1",
    brainLifecycleStatus: "working-candidate",
    output: null,
    error: null,
  });

  assert.equal(run.caseId, atlasCase.caseId);
  assert.equal(run.correlationId, "corr-1");
});

test("governed learning cannot silently promote material behavior changes", () => {
  for (const target of ["routing", "evaluation", "workflow", "prompt_or_model", "governance"] as const) {
    const decision = classifyAtlasImprovement(target);
    assert.equal(decision.productionPromotionAllowed, false, target);
    assert.equal(decision.ownerApprovalRequired, true, target);
  }
});

test("low-risk operational learning may update delegated adaptive layers", () => {
  for (const target of ["working_memory", "operational_knowledge"] as const) {
    const decision = classifyAtlasImprovement(target);
    assert.equal(decision.productionPromotionAllowed, true, target);
    assert.equal(decision.ownerApprovalRequired, false, target);
  }
});
