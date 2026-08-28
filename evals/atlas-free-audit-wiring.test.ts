import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Free Audit invokes Atlas and retains the human review gate", async () => {
  const route = await readFile("lib/audit/submit-handler.ts", "utf8");

  assert.match(route, /runAtlasFreeAudit\(intake, caseId\)/);
  assert.match(route, /transition\(record, "DOMAIN_ANALYSIS", "QA_PENDING"/);
  assert.doesNotMatch(route, /transition\(record, "DOMAIN_ANALYSIS", "PREVIEW_RELEASED"/);
  assert.match(route, /status: "pending_review"/);
});

test("Netlify routes the audit lifecycle through native Functions v2 handlers", async () => {
  const config = await readFile("netlify.toml", "utf8");
  const submit = await readFile("netlify/functions/audit-submit.ts", "utf8");
  const status = await readFile("netlify/functions/audit-case.ts", "utf8");
  const review = await readFile("netlify/functions/audit-review.ts", "utf8");
  const readiness = await readFile("netlify/functions/audit-readiness.ts", "utf8");

  assert.match(config, /from = "\/api\/audit"/);
  assert.match(config, /from = "\/api\/audit\/:caseId"/);
  assert.match(config, /from = "\/api\/admin\/reviews"/);
  assert.match(config, /from = "\/api\/audit\/readiness"/);
  assert.match(submit, /export default async function/);
  assert.match(status, /export default async function/);
  assert.match(review, /export default async function/);
  assert.match(readiness, /writesPerformed: false/);
});

test("Atlas Free Audit is explicitly non-operational and review-only", async () => {
  const runtime = await readFile("lib/atlas/free-audit.ts", "utf8");

  assert.match(runtime, /review candidate/);
  assert.match(runtime, /human must approve it before release/);
  assert.match(runtime, /Do not browse, contact anyone, publish, deploy, approve/);
  assert.match(runtime, /Do not delegate specialist tasks in Free Audit mode/);
  assert.match(runtime, /ATLAS_FREE_AUDIT_MAX_TURNS \|\| 3/);
  assert.match(runtime, /partialAuditSchema/);
});
