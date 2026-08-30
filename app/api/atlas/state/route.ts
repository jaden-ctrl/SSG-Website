import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  appendAtlasAuditEvent,
  decideAtlasApproval,
  getAtlasCase,
  getAtlasRun,
  listAtlasAuditEvents,
  recordAtlasOutcome,
  saveAtlasCase,
} from "@/lib/atlas/store";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.ATLAS_INTERNAL_TOKEN;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("decide-approval"),
    approvalId: z.string().min(1),
    approved: z.boolean(),
    decidedBy: z.string().min(1),
    decisionNote: z.string().max(4_000).optional(),
  }),
  z.object({
    action: z.literal("record-outcome"),
    caseId: z.string().min(1),
    runId: z.string().min(1).nullable().optional(),
    recordedBy: z.string().min(1),
    outcome: z.enum(["success", "partial", "failure"]),
    summary: z.string().min(1).max(8_000),
    evidence: z.array(z.string().max(2_000)).max(20).optional(),
    feedback: z.string().max(8_000).nullable().optional(),
  }),
]);

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "caseId is required" }, { status: 400 });

  const atlasCase = await getAtlasCase(caseId);
  if (!atlasCase) return NextResponse.json({ error: "Atlas case not found" }, { status: 404 });

  const audit = await listAtlasAuditEvents(caseId);
  return NextResponse.json({ case: atlasCase, audit });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const action = actionSchema.parse(await request.json());

    if (action.action === "decide-approval") {
      const approval = await decideAtlasApproval(action);
      const run = await getAtlasRun(approval.runId);
      const atlasCase = await getAtlasCase(approval.caseId);
      const correlationId = run?.correlationId || crypto.randomUUID();

      if (atlasCase) {
        await saveAtlasCase({
          ...atlasCase,
          status: action.approved ? "active" : "blocked",
          currentRunId: approval.runId,
        });
      }

      await appendAtlasAuditEvent({
        eventType: action.approved ? "approval.granted" : "approval.denied",
        caseId: approval.caseId,
        runId: approval.runId,
        correlationId,
        actor: action.decidedBy,
        payload: {
          approvalId: approval.approvalId,
          decisionNote: approval.decisionNote,
        },
      });

      return NextResponse.json({ approval });
    }

    const atlasCase = await getAtlasCase(action.caseId);
    if (!atlasCase) return NextResponse.json({ error: "Atlas case not found" }, { status: 404 });
    const run = action.runId ? await getAtlasRun(action.runId) : null;
    if (action.runId && (!run || run.caseId !== action.caseId)) {
      return NextResponse.json({ error: "runId does not belong to caseId" }, { status: 400 });
    }

    const outcome = await recordAtlasOutcome({
      caseId: action.caseId,
      runId: action.runId || null,
      recordedBy: action.recordedBy,
      outcome: action.outcome,
      summary: action.summary,
      evidence: action.evidence || [],
      feedback: action.feedback ?? null,
    });

    await saveAtlasCase({
      ...atlasCase,
      status: action.outcome === "success" ? "completed" : action.outcome === "failure" ? "blocked" : "active",
      currentRunId: action.runId || atlasCase.currentRunId,
    });

    await appendAtlasAuditEvent({
      eventType: "outcome.recorded",
      caseId: action.caseId,
      runId: action.runId || null,
      correlationId: run?.correlationId || crypto.randomUUID(),
      actor: action.recordedBy,
      payload: {
        outcomeId: outcome.outcomeId,
        outcome: outcome.outcome,
        summary: outcome.summary,
        evidence: outcome.evidence,
        feedback: outcome.feedback,
      },
    });

    return NextResponse.json({ outcome });
  } catch (cause) {
    if (cause instanceof ZodError) {
      return NextResponse.json({ error: "Invalid Atlas state action", fields: cause.flatten().fieldErrors }, { status: 400 });
    }
    console.error("Atlas state action failed", cause);
    return NextResponse.json({ error: "Atlas state action failed" }, { status: 500 });
  }
}
