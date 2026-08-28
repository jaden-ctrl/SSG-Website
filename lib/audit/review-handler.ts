import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { z } from "zod";
import { projectReleasedLead } from "../actions/leads";
import { cases, transition, type AuditCase, type CaseRepository } from "../cases/repository";

const reviewerRole = "ssg-reviewer";
const caseIdSchema = z.string().uuid();
const bodySchema = z
  .object({
    caseId: caseIdSchema,
    decision: z.enum(["approved", "rejected"]),
    expectedVersion: z.number().int().nonnegative(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

type ReviewIdentity = {
  id: string;
  email?: string | null;
  roles: string[];
};

export type ReviewHandlerDependencies = {
  repository: Pick<CaseRepository, "get" | "listByState" | "saveIfVersion">;
  currentUser: () => Promise<ReviewIdentity | null>;
  assertSameOrigin: (request: Request) => void;
  releaseLead: typeof projectReleasedLead;
  now: () => string;
};

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function summary(record: AuditCase) {
  return {
    caseId: record.caseId,
    state: record.state,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    company: record.intake.company,
  };
}

function detail(record: AuditCase) {
  const {
    firstName,
    lastName,
    email,
    company,
    website,
    teamSize,
    offer,
    challenge,
    attempts,
    goal,
    revenueRange,
  } = record.intake;

  return {
    ...summary(record),
    intake: {
      firstName,
      lastName,
      email,
      company,
      website,
      teamSize,
      offer,
      challenge,
      attempts,
      goal,
      revenueRange,
    },
    previewCandidate: record.previewCandidate ?? null,
  };
}

const productionDependencies: ReviewHandlerDependencies = {
  repository: cases,
  currentUser: async () => {
    const user = await getUser();
    return user ? { id: user.id, email: user.email, roles: user.roles ?? [] } : null;
  },
  assertSameOrigin: verifyRequestOrigin,
  releaseLead: projectReleasedLead,
  now: () => new Date().toISOString(),
};

export function createAuditReviewHandler(dependencies: ReviewHandlerDependencies) {
  return async function auditReviewHandler(request: Request) {
    try {
      const reviewer = await dependencies.currentUser();
      if (!reviewer) return privateJson({ error: "Unauthorized" }, 401);
      if (!reviewer.roles.includes(reviewerRole)) return privateJson({ error: "Forbidden" }, 403);

      if (request.method === "GET") {
        const requestedCaseId = new URL(request.url).searchParams.get("caseId");
        if (requestedCaseId) {
          if (!caseIdSchema.safeParse(requestedCaseId).success) return privateJson({ error: "Not found" }, 404);
          const record = await dependencies.repository.get(requestedCaseId);
          if (!record || record.state !== "QA_PENDING") return privateJson({ error: "Not found" }, 404);
          return privateJson({ case: detail(record) });
        }

        const pending = await dependencies.repository.listByState("QA_PENDING");
        pending.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        return privateJson({ cases: pending.slice(0, 100).map(summary) });
      }

      if (request.method !== "POST") {
        return new Response(null, { status: 405, headers: { ...noStoreHeaders, Allow: "GET, POST" } });
      }

      try {
        dependencies.assertSameOrigin(request);
      } catch {
        return privateJson({ error: "Forbidden" }, 403);
      }

      const parsed = bodySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return privateJson({ error: "Invalid review request" }, 400);
      const input = parsed.data;
      const record = await dependencies.repository.get(input.caseId);
      if (!record) return privateJson({ error: "Case not found" }, 404);
      if (record.state !== "QA_PENDING" || record.version !== input.expectedVersion) {
        return privateJson({ error: "This case was already updated. Refresh the queue." }, 409);
      }

      const review = {
        reviewer: reviewer.id,
        decision: input.decision,
        decidedAt: dependencies.now(),
        ...(input.notes ? { notes: input.notes } : {}),
      } as const;

      if (input.decision === "rejected") {
        const held = transition(record, "QA_PENDING", "MANUAL_REVIEW", { review });
        if (!(await dependencies.repository.saveIfVersion(held, input.expectedVersion))) {
          return privateJson({ error: "This case was already updated. Refresh the queue." }, 409);
        }
        console.info(JSON.stringify({ event: "preview_held", caseId: record.caseId, reviewer: reviewer.id }));
        return privateJson({ status: "manual_review", caseId: record.caseId });
      }

      if (!record.previewCandidate) {
        return privateJson({ error: "This case has no review candidate and cannot be released." }, 409);
      }

      const approved = transition(record, "QA_PENDING", "PREVIEW_APPROVED", { review });
      const released = transition(approved, "PREVIEW_APPROVED", "PREVIEW_RELEASED", {
        releasedPreview: record.previewCandidate,
      });
      if (!(await dependencies.repository.saveIfVersion(released, input.expectedVersion))) {
        return privateJson({ error: "This case was already updated. Refresh the queue." }, 409);
      }

      try {
        await dependencies.releaseLead({
          ...released.intake,
          id: released.caseId,
          createdAt: released.createdAt,
          status: "analyzed",
          audit: released.releasedPreview,
        });
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "released_lead_projection_failed",
            caseId: released.caseId,
            error: error instanceof Error ? error.name : "UnknownError",
          }),
        );
      }

      console.info(JSON.stringify({ event: "preview_released", caseId: released.caseId, reviewer: reviewer.id }));
      return privateJson({ status: "released", caseId: released.caseId });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "review_handler_failed",
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      return privateJson({ error: "Review service unavailable" }, 500);
    }
  };
}

export const handleAuditReview = createAuditReviewHandler(productionDependencies);
