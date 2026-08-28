import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { handleAuditCase } from "../lib/audit/case-handler";
import { createAuditReviewHandler, type ReviewHandlerDependencies } from "../lib/audit/review-handler";
import type { AuditCase, CaseRepository } from "../lib/cases/repository";
import { SSGAI_AGENT_RELEASE, SSG_BRAIN_BASELINE } from "../lib/governance/manifest";
import type { PartialAudit } from "../lib/schemas";

const candidate: PartialAudit = {
  overallScore: 62,
  executiveSummary: "The business has a viable offer but an inconsistent conversion and follow-up system.",
  primaryConstraint: "Prospects do not move through a consistent conversion path.",
  findings: ["Strategy", "Systems", "Growth", "Execution", "Leadership"].map((dimension, index) => ({
    dimension: dimension as "Strategy" | "Systems" | "Growth" | "Execution" | "Leadership",
    score: 55 + index,
    title: `${dimension} finding`,
    observation: `Evidence-backed ${dimension.toLowerCase()} observation.`,
    recommendation: `Prioritize the ${dimension.toLowerCase()} operating step.`,
  })),
  thirtyDayPriority: "Instrument the lead path and establish a weekly review cadence.",
  evidenceGaps: ["Validated conversion rates"],
  confidence: "medium",
  fullAuditOpportunity: "Validate the complete acquisition and follow-up system.",
};

function makeCase(overrides: Partial<AuditCase> = {}): AuditCase {
  const now = "2026-08-28T12:00:00.000Z";
  return {
    caseId: "4d922ed4-84b2-44c6-a855-046e2a70edc9",
    tenantId: "pretenant:private",
    accessTokenHash: "a".repeat(64),
    version: 6,
    state: "QA_PENDING",
    createdAt: now,
    updatedAt: now,
    intake: {
      firstName: "Jaden",
      lastName: "Shipley",
      email: "review-test@example.com",
      company: "Shipley Solutions Group",
      website: "https://example.com",
      teamSize: "1",
      offer: "Business systems and growth consulting.",
      challenge: "The current lead path needs a consistent operating system.",
      attempts: "Manual follow-up and organic publicity.",
      goal: "Build a repeatable revenue and delivery system.",
      revenueRange: "Under $250K",
      consent: "true",
      faxNumber: "",
    },
    inputSnapshotHash: "b".repeat(64),
    consent: { noticeVersion: "v1", purpose: "audit", recordedAt: now },
    governance: { ...SSG_BRAIN_BASELINE, ...SSGAI_AGENT_RELEASE },
    previewCandidate: candidate,
    ...overrides,
  };
}

function memoryRepository(initial: AuditCase[]) {
  const records = new Map(initial.map((record) => [record.caseId, structuredClone(record)]));
  let reads = 0;
  let writes = 0;
  const repository: Pick<CaseRepository, "get" | "listByState" | "saveIfVersion"> = {
    async get(caseId) {
      reads += 1;
      const record = records.get(caseId);
      return record ? structuredClone(record) : null;
    },
    async listByState(state) {
      reads += 1;
      return [...records.values()].filter((record) => record.state === state).map((record) => structuredClone(record));
    },
    async saveIfVersion(record, expectedVersion) {
      const current = records.get(record.caseId);
      if (!current || current.version !== expectedVersion) return false;
      records.set(record.caseId, structuredClone(record));
      writes += 1;
      return true;
    },
  };
  return { repository, records, stats: () => ({ reads, writes }) };
}

function buildHandler(
  repository: ReviewHandlerDependencies["repository"],
  options: { user?: { id: string; email: string; roles: string[] } | null; rejectOrigin?: boolean; onRelease?: () => void } = {},
) {
  return createAuditReviewHandler({
    repository,
    currentUser: async () => options.user === undefined ? { id: "reviewer-1", email: "reviewer@example.com", roles: ["ssg-reviewer"] } : options.user,
    assertSameOrigin: () => {
      if (options.rejectOrigin) throw new Error("origin mismatch");
    },
    releaseLead: async () => {
      options.onRelease?.();
    },
    now: () => "2026-08-28T12:30:00.000Z",
  });
}

function post(caseId: string, body: Record<string, unknown>) {
  return new Request("https://deploy-preview-9--example.netlify.app/api/admin/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://deploy-preview-9--example.netlify.app" },
    body: JSON.stringify({ caseId, ...body }),
  });
}

test("review API fails closed before accessing the case store", async () => {
  for (const user of [null, { id: "member-1", email: "member@example.com", roles: ["member"] }]) {
    const memory = memoryRepository([makeCase()]);
    const response = await buildHandler(memory.repository, { user })(new Request("https://example.net/api/admin/reviews"));
    assert.equal(response.status, user ? 403 : 401);
    assert.deepEqual(memory.stats(), { reads: 0, writes: 0 });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }

  const memory = memoryRepository([makeCase()]);
  const unauthorizedPost = await buildHandler(memory.repository, { user: null })(post(makeCase().caseId, { decision: "approved", expectedVersion: 6 }));
  assert.equal(unauthorizedPost.status, 401);
  assert.deepEqual(memory.stats(), { reads: 0, writes: 0 });
});

test("queue summaries are pending-only, ordered, and omit private case data", async () => {
  const older = makeCase({ caseId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-08-27T12:00:00.000Z" });
  const newer = makeCase({ caseId: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-28T12:00:00.000Z" });
  const memory = memoryRepository([older, newer, makeCase({ caseId: "33333333-3333-4333-8333-333333333333", state: "PREVIEW_RELEASED" })]);
  const response = await buildHandler(memory.repository)(new Request("https://example.net/api/admin/reviews"));
  const payload = await response.json() as { cases: Array<{ caseId: string }> };
  assert.equal(response.status, 200);
  assert.deepEqual(payload.cases.map(({ caseId }) => caseId), [newer.caseId, older.caseId]);
  const serialized = JSON.stringify(payload);
  for (const privateField of ["accessTokenHash", "tenantId", "previewCandidate", "releasedPreview", "consent", "email", "challenge", "goal"]) {
    assert.doesNotMatch(serialized, new RegExp(privateField, "i"));
  }
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("authorized detail exposes only the review fields for a pending case", async () => {
  const record = makeCase();
  const memory = memoryRepository([record]);
  const response = await buildHandler(memory.repository)(new Request(`https://example.net/api/admin/reviews?caseId=${record.caseId}`));
  const payload = await response.json() as { case: Record<string, unknown> };
  assert.equal(response.status, 200);
  assert.deepEqual(payload.case.previewCandidate, candidate);
  const serialized = JSON.stringify(payload);
  for (const privateField of ["accessTokenHash", "tenantId", "inputSnapshotHash", "consent", "releasedPreview", "governance", "faxNumber"]) {
    assert.doesNotMatch(serialized, new RegExp(privateField, "i"));
  }
  assert.equal(response.headers.get("cache-control"), "private, no-store");

  const releasedMemory = memoryRepository([makeCase({ state: "PREVIEW_RELEASED" })]);
  const unavailable = await buildHandler(releasedMemory.repository)(new Request(`https://example.net/api/admin/reviews?caseId=${record.caseId}`));
  assert.equal(unavailable.status, 404);
});

test("approval is atomic, releases the exact candidate, and projects once", async () => {
  const record = makeCase();
  const memory = memoryRepository([record]);
  let releases = 0;
  const handler = buildHandler(memory.repository, { onRelease: () => { releases += 1; } });
  const body = { decision: "approved", expectedVersion: record.version, notes: "Approved after reviewing the evidence gaps." };
  const [first, second] = await Promise.all([handler(post(record.caseId, body)), handler(post(record.caseId, body))]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.equal(second.headers.get("cache-control"), "private, no-store");
  assert.equal(releases, 1);
  assert.equal(memory.stats().writes, 1);
  const saved = memory.records.get(record.caseId);
  assert.equal(saved?.state, "PREVIEW_RELEASED");
  assert.equal(saved?.version, record.version + 2);
  assert.deepEqual(saved?.releasedPreview, candidate);
  assert.equal(saved?.review?.reviewer, "reviewer-1");
  assert.equal(saved?.review?.decision, "approved");
  assert.equal(saved?.review?.notes, body.notes);
  assert.equal(saved?.review?.decidedAt, "2026-08-28T12:30:00.000Z");
});

test("hold records server-derived reviewer metadata and never releases", async () => {
  const record = makeCase();
  const memory = memoryRepository([record]);
  let releases = 0;
  const response = await buildHandler(memory.repository, { onRelease: () => { releases += 1; } })(
    post(record.caseId, { decision: "rejected", expectedVersion: record.version, notes: "Needs a human follow-up call." }),
  );
  assert.equal(response.status, 200);
  const saved = memory.records.get(record.caseId);
  assert.equal(saved?.state, "MANUAL_REVIEW");
  assert.equal(saved?.releasedPreview, undefined);
  assert.equal(saved?.review?.reviewer, "reviewer-1");
  assert.equal(saved?.review?.decision, "rejected");
  assert.equal(saved?.review?.notes, "Needs a human follow-up call.");
  assert.equal(saved?.review?.decidedAt, "2026-08-28T12:30:00.000Z");
  assert.equal(releases, 0);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("origin, body, candidate, and stale-version checks fail safely", async () => {
  const record = makeCase();
  const memory = memoryRepository([record]);
  const forbidden = await buildHandler(memory.repository, { rejectOrigin: true })(post(record.caseId, { decision: "approved", expectedVersion: record.version }));
  assert.equal(forbidden.status, 403);

  const clientReviewer = await buildHandler(memory.repository)(post(record.caseId, { decision: "approved", expectedVersion: record.version, reviewer: "spoofed" }));
  assert.equal(clientReviewer.status, 400);

  const stale = await buildHandler(memory.repository)(post(record.caseId, { decision: "approved", expectedVersion: record.version - 1 }));
  assert.equal(stale.status, 409);

  const missingCandidate = makeCase({ caseId: "55555555-5555-4555-8555-555555555555", previewCandidate: undefined });
  const missingMemory = memoryRepository([missingCandidate]);
  const missing = await buildHandler(missingMemory.repository)(post(missingCandidate.caseId, { decision: "approved", expectedVersion: missingCandidate.version }));
  assert.equal(missing.status, 409);
  assert.equal(missingMemory.stats().writes, 0);
});

test("unsupported review methods return a private method contract", async () => {
  const memory = memoryRepository([makeCase()]);
  const response = await buildHandler(memory.repository)(new Request("https://example.net/api/admin/reviews", { method: "PATCH" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, POST");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("public case status hides every draft until the approved preview is released", async () => {
  const token = "requester-secret";
  const accessTokenHash = createHash("sha256").update(token).digest("hex");
  const request = (caseId: string, suppliedToken = token) => new Request(`https://example.net/api/audit/${caseId}`, {
    headers: { authorization: `Bearer ${suppliedToken}` },
  });

  for (const state of ["QA_PENDING", "MANUAL_REVIEW", "PREVIEW_APPROVED"] as const) {
    const record = makeCase({
      state,
      accessTokenHash,
      review: { reviewer: "reviewer-1", decision: state === "MANUAL_REVIEW" ? "rejected" : "approved", decidedAt: "2026-08-28T12:30:00.000Z" },
    });
    const response = await handleAuditCase(request(record.caseId), record.caseId, { get: async () => record });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const serialized = JSON.stringify(payload);
    for (const privateField of ["previewCandidate", "intake", "review", "executiveSummary", "accessTokenHash"]) {
      assert.doesNotMatch(serialized, new RegExp(`"${privateField}"\\s*:`, "i"), `${state} leaked ${privateField}`);
    }
  }

  const released = makeCase({ state: "PREVIEW_RELEASED", accessTokenHash, releasedPreview: candidate });
  const releasedResponse = await handleAuditCase(request(released.caseId), released.caseId, { get: async () => released });
  assert.deepEqual(await releasedResponse.json(), { status: "released", audit: candidate });
});

test("unknown cases and missing or incorrect requester tokens are indistinguishable", async () => {
  const token = "requester-secret";
  const record = makeCase({ accessTokenHash: createHash("sha256").update(token).digest("hex") });
  const repository = { get: async (caseId: string) => caseId === record.caseId ? record : null };
  const requests = [
    new Request(`https://example.net/api/audit/${record.caseId}`),
    new Request(`https://example.net/api/audit/${record.caseId}`, { headers: { authorization: "Bearer wrong-token" } }),
    new Request("https://example.net/api/audit/00000000-0000-4000-8000-000000000000", { headers: { authorization: `Bearer ${token}` } }),
  ];
  const responses = await Promise.all(requests.map((request) => handleAuditCase(request, new URL(request.url).pathname.split("/").pop() || "", repository)));
  const payloads = await Promise.all(responses.map((response) => response.clone().json()));
  assert.deepEqual(responses.map((response) => response.status), [404, 404, 404]);
  assert.deepEqual(payloads, [{ error: "Not found" }, { error: "Not found" }, { error: "Not found" }]);
});
