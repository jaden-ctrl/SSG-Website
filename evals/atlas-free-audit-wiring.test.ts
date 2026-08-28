import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { storageBackend, storageScope, withNetlifyStorage } from "../lib/storage/runtime";

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
  const cases = await readFile("lib/cases/repository.ts", "utf8");
  const leads = await readFile("lib/actions/leads.ts", "utf8");

  assert.match(config, /from = "\/api\/audit"/);
  assert.match(config, /from = "\/api\/audit\/:caseId"/);
  assert.match(config, /from = "\/api\/admin\/reviews"/);
  assert.match(config, /from = "\/api\/audit\/readiness"/);
  assert.match(submit, /export default async function/);
  assert.match(status, /export default async function/);
  assert.match(review, /export default async function/);
  assert.match(submit, /withNetlifyStorage\(context/);
  assert.match(status, /withNetlifyStorage\(context/);
  assert.match(review, /withNetlifyStorage\(context/);
  assert.match(submit, /method: "POST"/);
  assert.match(status, /method: "GET"/);
  assert.match(review, /method: "POST"/);
  assert.match(readiness, /method: "GET"/);
  assert.match(readiness, /\.get\("__readiness__"/);
  assert.match(readiness, /writesPerformed: false/);
  assert.match(cases, /storageBackend\(\)===\"netlify\"/);
  assert.match(cases, /openNetlifyStore\("ssgai-cases"\)/);
  assert.match(leads, /storageBackend\(\) === "netlify"/);
  assert.match(leads, /openNetlifyStore\("ssgai-leads"\)/);
});

test("storage runtime uses deploy-scoped Blobs for previews and site-scoped Blobs for production", async () => {
  await withNetlifyStorage({ deploy: { context: "deploy-preview" } }, async () => {
    assert.equal(storageBackend(), "netlify");
    assert.equal(storageScope(), "deploy");
  });

  await withNetlifyStorage({ deploy: { context: "production" } }, async () => {
    assert.equal(storageBackend(), "netlify");
    assert.equal(storageScope(), "site");
  });
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
