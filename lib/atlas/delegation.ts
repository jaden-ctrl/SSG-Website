import { run, tool } from "@openai/agents";
import { z } from "zod";
import { atlasTaskContractSchema } from "./task-contract";
import { getAtlasRuntimeContext } from "./runtime-context";
import { appendAtlasAuditEvent } from "./store";
import {
  digitalDeliveryAgent,
  growthSystemsAgent,
  qaAssuranceAgent,
  researchIntelligenceAgent,
  specialistOutputSchema,
} from "./specialists";

const specialistIdSchema = z.enum([
  "research-intelligence",
  "growth-systems",
  "digital-delivery",
  "qa-assurance",
]);

const delegationParametersSchema = z.object({
  specialistId: specialistIdSchema,
  task: atlasTaskContractSchema,
});

function selectSpecialist(id: z.infer<typeof specialistIdSchema>) {
  switch (id) {
    case "research-intelligence":
      return researchIntelligenceAgent;
    case "growth-systems":
      return growthSystemsAgent;
    case "digital-delivery":
      return digitalDeliveryAgent;
    case "qa-assurance":
      return qaAssuranceAgent;
  }
}

async function audit(eventType: "task.delegated" | "task.completed" | "task.failed", payload: Record<string, unknown>) {
  const context = getAtlasRuntimeContext();
  if (!context) return;
  await appendAtlasAuditEvent({
    eventType,
    caseId: context.caseId,
    runId: context.runId,
    correlationId: context.correlationId,
    actor: "atlas",
    payload,
  });
}

export const delegateSpecialistTask = tool({
  name: "delegate_specialist_task",
  description:
    "Delegate one bounded task to an Atlas specialist. Every delegation must use a validated task contract with explicit scope, constraints, allowed tools, prohibited actions, approvals, outputs, and evidence requirements.",
  parameters: delegationParametersSchema,
  async execute({ specialistId, task }) {
    const validatedTask = atlasTaskContractSchema.parse(task);
    const specialist = selectSpecialist(specialistId);

    await audit("task.delegated", {
      specialistId,
      taskId: validatedTask.taskId,
      objective: validatedTask.objective,
      successCondition: validatedTask.successCondition,
      allowedTools: validatedTask.allowedTools,
      prohibitedActions: validatedTask.prohibitedActions,
    });

    try {
      const result = await run(
        specialist,
        `Execute this subordinate task contract exactly as provided. Do not broaden scope or authority.\n${JSON.stringify(validatedTask)}`,
        { maxTurns: Number(process.env.ATLAS_SPECIALIST_MAX_TURNS || 5) },
      );

      if (!result.finalOutput) {
        throw new Error(`Atlas specialist ${specialistId} returned no final output`);
      }

      const parsed = specialistOutputSchema.parse(result.finalOutput);
      await audit("task.completed", {
        specialistId,
        taskId: validatedTask.taskId,
        confidence: parsed.confidence,
        escalationRequired: parsed.escalationRequired,
        escalationReason: parsed.escalationReason,
      });

      return JSON.stringify({
        specialistId,
        taskId: validatedTask.taskId,
        result: parsed,
      });
    } catch (error) {
      await audit("task.failed", {
        specialistId,
        taskId: validatedTask.taskId,
        error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown specialist failure",
      });
      throw error;
    }
  },
});
