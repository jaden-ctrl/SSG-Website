import "server-only";
import { run, tool } from "@openai/agents";
import { z } from "zod";
import { atlasTaskContractSchema } from "./task-contract";
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

const delegationResultSchema = z.object({
  specialistId: specialistIdSchema,
  taskId: z.string(),
  result: specialistOutputSchema,
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

export const delegateSpecialistTask = tool({
  name: "delegate_specialist_task",
  description:
    "Delegate one bounded task to an Atlas specialist. Every delegation must use a validated task contract with explicit scope, constraints, allowed tools, prohibited actions, approvals, outputs, and evidence requirements.",
  parameters: delegationParametersSchema,
  outputSchema: delegationResultSchema,
  async execute({ specialistId, task }) {
    const validatedTask = atlasTaskContractSchema.parse(task);
    const specialist = selectSpecialist(specialistId);

    const result = await run(
      specialist,
      `Execute this subordinate task contract exactly as provided. Do not broaden scope or authority.\n${JSON.stringify(validatedTask)}`,
      { maxTurns: Number(process.env.ATLAS_SPECIALIST_MAX_TURNS || 5) },
    );

    if (!result.finalOutput) {
      throw new Error(`Atlas specialist ${specialistId} returned no final output`);
    }

    return {
      specialistId,
      taskId: validatedTask.taskId,
      result: specialistOutputSchema.parse(result.finalOutput),
    };
  },
});
