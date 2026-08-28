import { z } from "zod";

export const atlasTaskContractSchema = z.object({
  taskId: z.string().min(1),
  objective: z.string().min(1),
  successCondition: z.string().min(1),
  scope: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  inputs: z.record(z.string(), z.unknown()).default({}),
  allowedTools: z.array(z.string()).default([]),
  prohibitedActions: z.array(z.string()).default([]),
  approvalRequiredFor: z.array(z.string()).default([]),
  expectedOutputs: z.array(z.string()).default([]),
  evidenceRequired: z.array(z.string()).default([]),
  parentTaskId: z.string().nullable().default(null),
});

export type AtlasTaskContract = z.infer<typeof atlasTaskContractSchema>;

export function createAtlasTaskContract(
  task: Omit<AtlasTaskContract, "taskId"> & { taskId?: string },
): AtlasTaskContract {
  return atlasTaskContractSchema.parse({
    ...task,
    taskId: task.taskId || crypto.randomUUID(),
  });
}
