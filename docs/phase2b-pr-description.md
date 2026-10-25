# Phase 2B lead automation

Do not merge without owner approval. This file is the draft pull request description. It is not an open pull request.

Candidate under review: `4d1921b296199c63e8448bb4b47984e2a2330042` on `phase2b-lead-automation`. Production release is not yet. PR review is ready only after the corrections in this description, and only with owner approval. A pull request is opened by the owner, not by this change.

## Summary

`/contact` and `/audit` still post to `/api/lead`. Capture stays on when `LEAD_AUTOMATION_ENABLED` is anything other than the exact string `true`. When the flag is `true`, the site creates one open follow-up task per contact, writes a note, associates a company only from a business email domain, and sends an internal notification. HubSpot workflows are not used.

Owner decisions in this revision:

- QA-2B-09: the company comes from the **email domain**. A free or consumer mailbox (Gmail, Yahoo, Outlook/Hotmail, iCloud, AOL, Proton, and the rest of the free-mail list) does **not** attach the company behind a typed website. The typed website stays on the contact only. This replaces the earlier website-first behavior.
- QA-2B-16: the legacy SSGAI lead webhook is removed. `LEAD_WEBHOOK_URL` stays off unless it is https, `LEAD_WEBHOOK_AUTHORIZED` is exactly `true`, and the secret is at least 32 characters. It still runs only in production live mode, and delivery is scheduled after the visitor response.

## Isolation design

Live HubSpot, Resend, SMTP, and the lead webhook require all of the following:

1. The build bakes `SSG_BUILD_CONTEXT` as `production` only when `CONTEXT` is exactly `production` (case-sensitive). On Netlify (`NETLIFY=true`), a missing or unrecognized `CONTEXT` — including `Production` — exits **1** with `build_context_invalid` and does not write the bake file. Recognized non-production values are `deploy-preview`, `branch-deploy`, and `dev`. `netlify.toml` sets the build command to `npm run build` and `NODE_VERSION` to 22.
2. The request `Host` is on the live allowlist. When `LEAD_PRODUCTION_HOSTS` is unset, that allowlist is `shipleysolutionsgroup.com`, `www.shipleysolutionsgroup.com`, and `ssg-site.netlify.app` (the production deploy's own Netlify address). **Setting `LEAD_PRODUCTION_HOSTS` replaces that default list** for who can go live. The apex, www, and `ssg-site.netlify.app` stay enforced in the fail-closed set even when a custom list omits them or the value cannot be parsed. If a custom list omits `ssg-site.netlify.app`, that host returns **503**, not live (L-4). `X-Forwarded-Host` is used only when it equals `Host`.
3. Mock mode and live-test mode never run on a production host. That includes a non-production bake on the apex and `LEAD_LIVE_TEST=true` on `ssg-site.netlify.app`. The response is **503** `{ok:false, code}` (`lead_mode_mismatch` or `lead_live_test_on_prod_host`), with a loud log and a rate-limited ops alert. The form shows an error. **`LEAD_LIVE_TEST=true` in the Production environment makes the main site return errors** (I-3). The apex fails closed. Never set that flag in Production. It is allowed only on a preview or branch deploy.
4. A runtime `CONTEXT`, when one is actually present and is not `production`, forces the request off the production path. It cannot promote a preview build.

`LEAD_LIVE_TEST=true` is the only non-production opt-in, and it is refused on every production host. Elsewhere it uses `HUBSPOT_TEST_ACCESS_TOKEN` and never `HUBSPOT_ACCESS_TOKEN`. Before any HubSpot write, live mode and live-test mode both read account-info through the gateway. Live mode must see portal `246622244`. Live-test must match `HUBSPOT_TEST_PORTAL_ID` and must not be `246622244`. A mismatch or an unreadable response does not write. The proof is recognized by `GET /account-info/v3/details` with no body. A caller-supplied purpose field cannot skip it.

The verified portal is cached per token for 10 minutes. **That cache allows writes for up to 10 minutes after the token's portal changes** (L-5). Quality measured five writes, then **503** `lead_portal_mismatch` (R9). Failures are not cached.

All of those calls go through `lib/gateway.ts`. Preview and branch deploys use an in-memory blob store. Live-test uses a deploy-scoped store named `{name}--livetest`. Production uses the site store only in live mode.

## Production success rule

On a production host, HTTP 2xx `{ok:true}` is returned only when one of these is true:

- The contact was written with the production token after account-info proved portal `246622244`.
- The site store has both the submission record (`sub/`) and its retry entry (`queue/`), so a later run can finish the write.

Every other production path is non-2xx `{ok:false, code}` and the form shows an error. The only 2xx without a lead record is honeypot or fast-fill spam (`spam/` marker, zero HubSpot calls). A production host never writes with the test token or to the test portal.

If HubSpot is down and the store is up, the lead is queued and the response is 200 `{status:"queued"}`. If the store is down and HubSpot verified the contact, the response is 200. If the store is down and a later step did not finish, the response is **502** `lead_partial_nondurable`. If both the site store and HubSpot are down, the response is non-2xx. Quality measured **503** `lead_live_test_blocked` for that case (D-97, P-105/107/109). That label is semantically misleading: it is Quality's **L-1**, a follow-up fix, not the intended code. Automate's offline probe I5 recorded **502** `lead_store_unavailable` for store-down and HubSpot-down.

A portal mismatch with a durable store returns **503** `lead_portal_mismatch` and writes nothing to HubSpot, while the lead stays queued. A resubmit with the same client id then returns **200** `duplicate` and the form shows the thank-you, still with nothing in HubSpot (Automate **N-2**, probe I4). The invariant holds. The two responses contradict each other. That is an open decision (D2), not the intended duplicate path. On later scheduled runs a portal-check failure is retried with no cap (Automate **N-1**).

An invalid `LEAD_STORE_KEY` is logged and alerted as `lead_store_key_invalid` and is non-durable. A missing key in live mode is logged as `lead_store_unavailable`. Quality measured **503** `lead_portal_unverified` when the key is unset or invalid and HubSpot is down (C-93/94). That label is semantically misleading: it is Quality's **L-2**, a follow-up fix, not the intended code for a store-key failure. Automate's probe I8 recorded **502** plus the `lead_store_key_invalid` log. HTTP 200 after a verified contact still does not cover a missing key when the task, note, or email failed: those steps are never retried (Automate **N-6**).

A repeated submission of a lead that was actually saved does not create a second contact or a second open follow-up task. The same `client_submission_id` (double-click or timeout retry) reuses the stored record. The same email with a new id upserts the contact and appends the open task. The mismatch-then-resubmit case above is N-2, not this path.

The retry loop isolates each record. A corrupt or undecryptable record is dead-lettered with `lead_poison_record` and does not stop the others. Other failures use the existing backoff and `LEAD_MAX_ATTEMPTS` (default 6; backoff 5m, 15m, 1h, 4h, 12h), then `lead_dead_letter`, with an alert. Housekeeping still runs. A portal-check failure inside `runDue` does not use that budget (N-1). Recovery: `GET` and `POST /api/admin/lead-dlq` with `Authorization: Bearer $SSGAI_REVIEW_TOKEN`, or `node --experimental-strip-types --import ./tests/register.mjs scripts/lead-dlq.ts list|requeue <subKey>`. Requeue clears the attempt count and puts the record back on `queue/`. **It does not require a dead-letter state.** Any record is accepted and its attempts reset (Automate **N-4**). The route has no rate limit, shares `SSGAI_REVIEW_TOKEN` with `/api/admin/reviews`, and does not audit the actor (Automate **N-5**). A poison payload stays isolated until the store key matches. The settle-path dead-letter marker records reason `attempts` and has no `code` field (I-1). The 22s per-run budget is checked only between items and has not been measured against the 30s scheduled-function limit (Automate **N-3**, treat as Moderate until measured).

## Error codes

Non-2xx lead responses are `{ok:false, code, error}`. The same `code` is written on the log event.

| Code | When |
|---|---|
| `lead_mode_mismatch` | Mock mode on a production host, or a production bake that resolved to mock. |
| `lead_live_test_on_prod_host` | `LEAD_LIVE_TEST=true` on a production host, including the apex when that flag is set in the Production environment. |
| `lead_live_test_blocked` | Intended: live-test portal proof failed (production portal, missing test credentials, or unreadable account-info). **Not intended (Quality L-1, follow-up):** the same code is also what Quality measured for both-stores-down in production live mode. The label is semantically misleading. Relabel. |
| `lead_portal_mismatch` | Live token's account-info portal is not `246622244`. No CRM write. With a durable store the first response is 503 while the lead is queued, and a same-id resubmit is 200 `duplicate` (Automate N-2). Scheduled retries of the portal check are uncapped (Automate N-1). |
| `lead_portal_unverified` | Intended: live account-info could not be read and the lead was not durable. **Not intended (Quality L-2, follow-up):** Quality also measured this code for an invalid or unset `LEAD_STORE_KEY` with HubSpot down. The label is semantically misleading. Relabel. |
| `lead_hubspot_unconfigured` | Live mode without `HUBSPOT_ACCESS_TOKEN`. |
| `lead_store_unavailable` | Log when the store write failed, or when the live key is missing. HTTP **502** when the contact was not verified on a path that did not fail the portal proof. Automate probe I5 recorded this 502 for store-down and HubSpot-down. Quality's both-stores-down label is L-1, not this code, and is not the intended name. |
| `lead_store_key_invalid` | Log and ops alert when `LEAD_STORE_KEY` is set but is not 32-byte base64. The store is treated as unavailable. The HTTP status in that case is a failure, not a success. Quality's **503** `lead_portal_unverified` label for this case is L-2, a follow-up, not the intended code. |
| `lead_partial_nondurable` | The shared store failed after the contact was saved and a later step did not finish. HTTP 502. |
| `lead_not_saved` | Live mode finished with neither a verified contact nor a durable queue. HTTP 502. |
| `lead_duplicate` | The same submission was already stored but was not saved or queued. A truthful duplicate of a saved or durably queued lead is 200 `{status:"duplicate", code:"lead_duplicate"}`. A 200 `duplicate` after a portal mismatch, with nothing in HubSpot, is Automate N-2, not this intended case. |
| `lead_invalid` / `lead_invalid_body` / `lead_body_too_large` / `lead_rate_limited` | Form, JSON, size, and rate-limit rejections. |
| `lead_submission_failed` | Unexpected handler error. HTTP 502. |
| `lead_poison_record` | Retry item could not be decrypted or parsed. Dead-lettered. |
| `lead_retry_item_failed` | One retry item failed and was rescheduled. |
| `lead_dead_letter` | Attempt budget exhausted, or a poison record was quarantined. A portal-check failure on retry does not reach this code (Automate N-1). |
| `lead_retry_skipped` | The scheduled function returned because mode was mock or blocked. |
| `lead_ops_alert` | Rate-limited ops alert (10 minutes per code). Email is sent only when the mailer can send and the mode is not mock or blocked. **QA18-F3 is only partial:** a production-host mismatch is itself mock or blocked, so the misconfiguration that most needs a page gets a log and no email (Automate N-7). |
| `build_context_invalid` | Netlify build exited because `CONTEXT` was missing or not a recognized value. |
| `lead_admin_unauthorized` / `lead_not_found` | Dead-letter admin route. |

## Production env vars

Set these on the production deploy before turning automation on. Do not copy the production HubSpot token onto preview or branch deploys.

| Variable | Notes |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | Private app token. The app needs `crm.objects.owners.read` in addition to the contact, company, note, and task scopes. Without the owners scope, tasks are blocked and an alert is sent; the contact is still saved. Whether this app can read `/account-info/v3/details` is still NEEDS LIVE TEST (QA14-N1). |
| `HUBSPOT_DEFAULT_OWNER_ID` | Numeric owner id. Unassigned tasks are not created. The live owner `94663488` is NEEDS LIVE TEST. |
| `HUBSPOT_PORTAL_ID` | `246622244` for record links. Account-info must return this portal before any production write. |
| `LEAD_AUTOMATION_ENABLED` | Exact `true` to create tasks, notes, company links, and notifications. Any other value skips those steps and logs `lead_automation_disabled`. |
| `LEAD_STORE_KEY` | Required for the production invariant (Automate N-6). 32-byte key, base64. A missing or invalid key is non-durable. An invalid key is logged as `lead_store_key_invalid`. Without the key, live mode returns 200 once the contact is saved even if the task, note, or email failed, and those steps are never retried. Quality's 503 `lead_portal_unverified` label when the key is bad and HubSpot is down is L-2, a follow-up, not the intended code. |
| `LEAD_HASH_SALT` | At least 32 characters. Required before production traffic. If it is missing, rate limiting fails open and a warning names `LEAD_HASH_SALT`. That warning is a log, not an email. |
| `LEAD_PRODUCTION_HOSTS` | Optional. **Setting it replaces the default live allowlist.** Include every host that should go live. The apex, www, and `ssg-site.netlify.app` stay in the fail-closed set even if omitted. Omitting `ssg-site.netlify.app` makes that host return 503, not live (L-4). An empty or unparseable value cannot go live, and the three defaults still fail closed. |
| `RESEND_API_KEY` | Send-only key. |
| `NOTIFY_EMAIL_TO` | Internal recipients. |
| `NOTIFY_EMAIL_FROM` | An address on `@shipleysolutionsgroup.com`, for example `SSG <notify@shipleysolutionsgroup.com>`. |

Resend domain authentication (SPF and DKIM) and a delivery test are required before activation. This change does not turn sending on and does not hard-code a from address. No live email was sent from this branch.

Leave `LEAD_WEBHOOK_URL` empty until the destination is separately authorized. Do not set `LEAD_WEBHOOK_AUTHORIZED` to `true` unless the URL is https and the secret is at least 32 characters. Webhook delivery uses a 3 second timeout and is not on the visitor request path. The scheduled function can retry a 5xx with the same event id. A 4xx other than 408 or 429 is not retried and alerts.

`OPENAI_API_KEY` is not required. The credential was revoked, and the lead path makes no model call.

### Must stay unset in Production

- `LEAD_LIVE_TEST` must not be `true`. Setting it in Production makes the apex, www, and `ssg-site.netlify.app` return **503** `lead_live_test_on_prod_host` (I-3). The main site shows an error instead of accepting a lead.
- Do not set `HUBSPOT_TEST_ACCESS_TOKEN`, `HUBSPOT_TEST_PORTAL_ID`, `HUBSPOT_TEST_DEFAULT_OWNER_ID`, `RESEND_TEST_API_KEY`, `NOTIFY_EMAIL_TEST_TO`, or `NOTIFY_EMAIL_TEST_FROM` on the production deploy. Those belong on preview or branch only.
- Do not copy `HUBSPOT_ACCESS_TOKEN` onto preview or branch deploys.
- Leave `LEAD_WEBHOOK_URL` empty and `LEAD_WEBHOOK_AUTHORIZED` unset until a destination is separately authorized.

Node is 22 (`engines` `>=22.6.0 <23`, `.nvmrc`, `NODE_VERSION` in `netlify.toml`). CI job `test-and-build` runs `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build` on pull requests and on pushes to `main`. CI does not set a `permissions:` block, and the actions are tag-pinned (`@v4`) rather than SHA-pinned (L-7). The CI build does not set `NETLIFY=true`; the developer tests cover that guard.

## Live-test gates

Controlled live preview is conditionally ready. These gates apply before any live-test on a preview or branch deploy. Production enablement is a separate, later decision.

1. Set `LEAD_LIVE_TEST=true` only on the preview or branch context. Never set it in the Production environment.
2. A person confirms in HubSpot that `HUBSPOT_TEST_ACCESS_TOKEN` belongs to the authorized non-production portal and that `HUBSPOT_TEST_PORTAL_ID` matches it. That portal must not be `246622244`.
3. The first action is an account-info read through the deploy (QA14-N1). On any **503** `lead_live_test_blocked`, stop.
4. Set `RESEND_TEST_API_KEY`, `NOTIFY_EMAIL_TEST_TO`, `NOTIFY_EMAIL_TEST_FROM`, `HUBSPOT_TEST_DEFAULT_OWNER_ID`, and a deploy-scoped `LEAD_STORE_KEY`. The production HubSpot token is absent on preview and branch deploys. Dead-letter and owner alerts go to the test recipient, not `NOTIFY_EMAIL_TO`.
5. Preview and deploy-permalink visitor access stays Private.
6. QA runs E2E-01 through E2E-14, plus duplicate contact and task counts, the store-key and dead-letter list and requeue against the real deploy store, the scheduled retry, email delivery, and the Playwright click-through against the preview URL.
7. Keep Shipley's Detailing out of the test data.

## Still NEEDS LIVE TEST before production

- Account-info `/account-info/v3/details` is readable by the test private app (preview) and by the production private app.
- The test token belongs to `HUBSPOT_TEST_PORTAL_ID`, which is not `246622244`.
- Netlify puts the custom domain in `Host` on the apex and www (QA-2B-15). If it does not, the result is 503, not a false success.
- The scheduled `lead-retry` function bundles and runs on Netlify (`*/10`).
- The real Blobs store works (deploy store for live-test, site store for production) with `LEAD_STORE_KEY`.
- Resend SPF, DKIM, delivery, and inbox placement, including the owner notification and the ops-alert email.
- Owner `94663488`, the owners scope, and association read-after-write lag.
- The dead-letter admin route against the real store, and `scripts/lead-dlq.ts` (the harness does not compile that script).
- Branch protection on `main` requires code-owner review and the CI `test-and-build` check.

Production stays blocked until the account-info, Host, scheduled-retry, Blobs, and Resend checks pass on production, `LEAD_HASH_SALT` is set, and `LEAD_AUTOMATION_ENABLED` is exactly `true`.

## QA status

The retest of `d3cd8f7` was conditionally ready for review and not ready for production. This revision addresses the code-fixable failures from that retest:

- QA-2B-09 company domain is the email domain; free-mail does not link the typed website's company.
- QA-2B-13 spam skips are logged as `lead_spam_skipped`.
- QA-2B-14 live-test portal is verified through account-info before any write.
- QA-2B-15 `X-Forwarded-Host` is not trusted ahead of `Host`.
- QA-2B-16 legacy SSGAI webhook removed.
- QA-2B-17 `lead_automation_disabled` is logged when the flag is not exactly `true`.
- QA-2B-18 `netlify.toml` pins the build, a Netlify build with a missing or unrecognized `CONTEXT` fails, and mock mode on a production host returns 503.
- QA18-F1 / C1 and C2: non-production bakes on the apex, www, or `ssg-site.netlify.app` return `lead_mode_mismatch`.
- QA18-F2 / C6: `write-build-context.mjs` exits non-zero before writing when `NETLIFY=true` and `CONTEXT` is missing or not exactly a recognized value.
- QA14-F1 / C4: live mode proves portal `246622244` before any write.
- QA18-F4 / C5: `LEAD_LIVE_TEST=true` on a production host returns `lead_live_test_on_prod_host`.
- FS-F2 / C3: one poison record is dead-lettered and the retry loop continues. Dead letters can be listed and requeued.
- QA-2B-19 missing `LEAD_HASH_SALT` is logged by name. Rate limit still fails open. Setting the salt in production is still required.
- QA-2B-20 admin reviews use `timingSafeEqual` and `safeParse` (400 for a bad body, 401 for a bad token). The env name remains `SSGAI_REVIEW_TOKEN`.
- QA-2B-21 live-test alerts use the test from/to pair.
- QA-2B-22 Node 22 is pinned and CI runs on it.
- QA-2B-23 the lead webhook is scheduled off the visitor path. Timeout stays 3 seconds.
- QA-2B-24 the scheduled retry import graph uses relative imports so the bundler does not need TypeScript path aliases. Confirming the scheduled function on Netlify still needs a production publish.

Rate-limit env names are `LEAD_RL_IP_PER_10M`, `LEAD_RL_EMAIL_PER_10M`, and `LEAD_RL_GLOBAL_PER_10M` (defaults 5 / 3 / 60). `LEAD_TASK_DEDUPE_DAYS` is not read.

SSG Quality's release report on `4d1921b` found 0 Critical, 0 High, and 0 Medium defects. C1–C6 and Automate's four Moderates are fixed offline. Controlled live preview is conditionally ready under the gates above. Production is not yet.

## Test evidence at 4d1921b

| Run | Result |
|---|---|
| Developer `npm test`, Node 22.23.4 | **62 tests, 62 pass, 0 fail** |
| `tsc --noEmit` (strict repo config) | exit 0 |
| QA reliability, duplicate, and dead-letter matrix | **18 passed, 0 failed** |
| Playwright Chromium headless on `/contact` and `/audit` | **54 passed, 0 failed** (50 routed, 2 real-server error, 2 real-server success) |
| INV sweep | **117 rows** (102 original + 15 new), 0 harness errors. **INV-1: 0 violations** (70 rows in scope). INV-2: 0. INV-3: 0 |

`121a9b9` had 19 INV-1 violations. `4d1921b` has 0. All 21 category-(a) preview rows (non-production bake on a non-production host) are still 200 mock.

Playwright: every error shape shows `.form-status.is-error[role=alert]` with "could not be confirmed". None showed `.submission-success` or "REQUEST RECEIVED", and the answers stayed in the form. The real production-bake server on `127.0.0.1` returned **503** `lead_mode_mismatch`. The real non-production bake returned 200 `received`.

QA's full harness was 219 rows: 209 PASSED, 9 FAILED, 1 NOT TESTED. None of the nine is a false success or a release-required failure (A-S1, A-SPL-04, A-LT-28 as the intended C5 change, A-PR-04 as the intended permalink 503, A-OAI-04 as the intended OpenAI removal, B-N1 as QA-2B-17, B-N2 as QA-2B-19, C-11 `minLength`, C-16 read-only extra account-info and contact GETs). A-PR-03 was not tested: a preview-to-production flip inside one process keeps the cached bake. That is not how deploys work (I-4).

The Netlify build matrix: `CONTEXT=production` exits 0 and bakes `production`; `deploy-preview` exits 0 and bakes `non-production`; unset and `Production` exit 1 and do not bake.

## Known lower-severity issues

| Id | Severity | Handling or justification | Owner |
|---|---|---|---|
| L-1 | Low | **Follow-up fix, not intended.** Quality measured `lead_live_test_blocked` for both-stores-down in production live mode (D-97, P-105/107/109). The code is semantically misleading. The response is non-2xx. Relabel. | Follow-up |
| L-2 | Low | **Follow-up fix, not intended.** Quality measured `lead_portal_unverified` when the store key is unset or invalid and HubSpot is down (C-93/94). That name describes an account-info failure, not a bad store key. Relabel. | Follow-up |
| L-3 | Low | Same behaviour as Automate N-1. Portal-check failures in `runDue` are retried uncapped. See N-1. Quality's note that the visitor got 503 and the record completes once the token is fixed (R8b) still applies. | Follow-up: N-1 |
| L-4 | Low | A custom `LEAD_PRODUCTION_HOSTS` **replaces** the live allowlist. The apex, www, and `ssg-site.netlify.app` stay fail-closed. Omitting `ssg-site.netlify.app` makes that host 503, not live. Documented here. | Documented |
| L-5 | Low | The portal-proof cache allows writes for up to 10 minutes after a portal change (R9: 5 writes, then 503). Accepted and documented. | Accepted |
| L-6 | Low | `@openai/agents` is a dead dependency. Nothing imports it. `analyzeBusiness` always returns the mock audit and does not call `paidAiAllowed`. Remove the package in a follow-up. Do not remove it in a docs-only change. | Follow-up removal |
| L-7 | Low | CI (`.github/workflows`) has no `permissions:` block, so the default token scope applies. Actions are tag-pinned (`@v4`), not SHA-pinned. CI does not exercise the `NETLIFY=true` guard; developer tests do. Follow-up: `permissions: contents: read` and SHA-pin. | Follow-up |
| L-8 | Low | There is no `.gitignore`. That risks committing `.env*`, `.next/`, or `node_modules/`. Add one in a follow-up. Not added in this docs-only change. | Follow-up |
| I-1 | Info | The settle-path dead-letter marker has no `code` (reason `attempts`). | Accepted |
| I-2 | Info | No ops email in mock or blocked mode. A skipped bake produces logs and the visitor-facing error only. The production-host case of this is QA18-F3, still partial (Automate N-7). | Follow-up (N-7) |
| I-3 | Info | `LEAD_LIVE_TEST=true` in the Production environment fails the apex closed. Never set it in Production. Preview and branch only. | Owner |
| I-4 | Info | A-PR-03 was not tested. A preview-to-production flip inside one process would keep the cached bake. The bake is fixed per deploy. | Accepted |
| QA14-N1 | Note | Whether the private app can read `/account-info/v3/details` is unverified. If it cannot, live and live-test fail closed (no CRM write). Confirm on the authorized test portal before enabling live-test, and on the production app before production. | Owner |
| QA-2B-15 | Note | It is unverified whether Netlify puts the custom domain in `Host`. If it does not, production leads return 503 instead of a silent success. Confirm on the first production deploy. | Owner |
| QA-2B-17 | Low | With the automation flag unset, no task or email is created. This is now logged as `lead_automation_disabled`. Production must set the flag to exactly `true`. | Owner |
| QA-2B-19 | Low | A missing `LEAD_HASH_SALT` still fails open and logs `lead_ratelimit_unavailable`. The salt must be set (at least 32 characters) before production traffic. | Owner |
| Permalink gap | Low | Automate D1 / R-1. A **non-production bake** on a production deploy permalink `<deployid>--ssg-site.netlify.app` returns 200 mock `received` and discards the lead. The host is outside the production scope. A runtime `CONTEXT=production` does not change it. A production bake on that same permalink returns 503. Likelihood is low: the same bad deploy is 503 on the apex, www, and `ssg-site.netlify.app`. Open decision D1: treat `^[0-9a-f]{24}--ssg-site\.netlify\.app$` as production-scope when the bake is not production, or restrict production publishes to Git-triggered Netlify builds and do not share permalinks. | Owner (D1) |
| Honeypot / fast fill | Info | HTTP 200 `{ok:true}` with a `spam/` marker and zero HubSpot calls. This is the only 2xx allowed without a lead record, so a bot is not told it was rejected. The form shows success. INV-3 holds. | Accepted |
| FS-F3 follow-up | Low | When the shared store throws after the contact is saved and a later step did not finish, the response is 502 `lead_partial_nondurable` so the form shows an error. The client retry upserts the same contact and task. | Accepted |

### Automate final review of 4d1921b

These items use SSG Automate's own ids and wording from its final review of `4d1921b`. None of them is a new High. N-3 is treated as Moderate until it is measured. Automate's earlier notes QA14-N1 and FS-N1 are unchanged: FS-N1 is resolved (`error.name` only), and QA14-N1 remains unverified offline.

| Id | Severity | Finding | Handling |
|---|---|---|---|
| Permalink gap | Low | A non-production bake served on a production deploy permalink `<id>--ssg-site.netlify.app` returns 200 mock `received` and the lead is discarded (D1). This is the one probed production scenario where the 2xx rule does not hold. A production bake on that permalink returns 503. The same bad deploy is loud (503) on the apex, www, and `ssg-site.netlify.app`. Likelihood is low. | Open. D1: code fix (treat a 24-hex `--ssg-site.netlify.app` host as production-scope when the bake is not production), or ops controls (Git-triggered publishes only, no CLI `--prod` or manual uploads, do not share permalinks). |
| QA18-F3 | Low, partial | A mismatch is still log-only for the case that most needs a page. `alertOps` logs only in mock or blocked mode, and a production-host mismatch is always mock or blocked, so no email is sent (remainder N-7). | Follow-up: send the ops email for these admission codes with a production mailer, or alert on the `lead_ops_alert` log. |
| N-1 | Low | A portal-check failure on retry (`portal_unverified` or `production_mismatch` inside `runDue`) `continue`s without bumping attempts, backoff, or a cap. The record stays `processing`, `nextAttemptAt` stays 0, and it is retried and re-proved every 10 minutes indefinitely. The scheduled path logs only. There is no ops email from that path. A global mismatch also re-proves once per item per run. Probe R2: 20 runs, 20 proofs, attempts unchanged. Leads are not lost. An account-info outage or a scope change piles production leads up as queued, visible only in logs (R-2). | Follow-up. On `portal_unverified`, set `nextAttemptAt` with backoff without consuming attempts. On `production_mismatch`, break the run. Call `alertOps` from `runDue`. Recommended before activation (D3). |
| N-2 | Low | A portal mismatch returns 503 although the lead is saved. With a durable store the first submit returns 503 (the form shows an error) while the lead is durably queued. A resubmit with the same client id returns 200 `duplicate` (thank-you) with nothing written to HubSpot. The invariant still holds. The visitor sees two contradictory outcomes (I4). | Open decision D2: return 200 `queued` plus a loud alert when durable, or make the duplicate path return 503 while the record's last error is a portal block. |
| N-3 | Low; **treat as Moderate until measured** | The scheduled-run 30s budget is unmeasured. The 22s budget is checked only between items. `collectDue` and housekeeping scan every `sub/`, `spam/`, `rl/`, and `lock/` key on every run. One item can chain many 8s calls, each retried once, and can exceed Netlify's 30s scheduled-function limit. A killed run leaves the item `processing` with no attempt bump. Not measured against real Blobs or HubSpot. A real Netlify scheduled run has not been exercised (R-3). | Follow-up: per-item deadline, scan `queue/` only, and bound housekeeping. D3. |
| N-4 | Low | DLQ requeue accepts any record and resets attempts. It does not require `state === "dead_letter"` or a `dlq/` marker. Completed, in-flight, and already-queued records are accepted and their attempt budget is reset to 0. A second requeue also returns 200 (A1, R4). | Follow-up: require a dead-letter state and marker, and return 409 otherwise. Recommended before activation (D3). |
| N-5 | Low | The DLQ admin route has no rate limit, a shared token, and no audit. The token is shared with `/api/admin/reviews` under the legacy name `SSGAI_REVIEW_TOKEN`. GET is not audited. The requeue log has no actor. The list is unbounded. | Follow-up: a dedicated `LEAD_ADMIN_TOKEN`, digest compare, IP-hash audit, pagination, and a rate-limit rule on `/api/admin/*`. |
| N-6 | Low | Live mode without `LEAD_STORE_KEY` returns 200 when the task or email fails, and never retries. Once the contact is saved, a failed task, note, or notify still returns 200 `received` (I7). Those steps are never retried. This differs from the fallback path's `lead_partial_nondurable`. | Activation requirement: set `LEAD_STORE_KEY`. Follow-up: 503 when the key is missing in live mode, or apply the same non-durable outcome here. |

#### Not testable offline

Automate's review is Tested (mocked) only. Nothing in it is Verified against real HubSpot, Netlify, or Resend. These items cannot be confirmed offline (R-4), plus the fidelity limit (R-5):

- Whether `GET /account-info/v3/details` is accessible to the private app. HubSpot's docs list no specific scope (QA14-N1). If it is not, every live lead stays queued (N-1).
- That path's "legacy" status. HubSpot also lists a dated `/account-info/2026-09/details`. A future deprecation would make every live lead `portal_unverified`.
- Whether Netlify puts the custom domain in `Host` (QA-2B-15). If it does not, production leads return 503, not a false success.
- Whether owner `94663488` is an active, unarchived owner id (not a user id) in portal `246622244`.
- Association read-after-write lag. With real HubSpot, a requeue can create a duplicate note if that lag hides the first note.
- Resend DNS (SPF, DKIM, delivery, inbox placement).
- Every HubSpot behaviour in the suite was tested against an in-memory CRM or a stubbed `fetch`, not against HubSpot (R-5).

## Not treated as code defects

- A-S1: `jadenshipley.com` links in `app/about/page.tsx` and `app/layout.tsx` are already on main. The harness also matched the word "webhooks." in a comment; that comment no longer says it.
- The harness `tsc` TS2339 errors at `lib/lead/intake.ts` come from `tsconfig.qa.json` with `strict:false`. The repo typecheck is strict.
- QA-2B-11: the public timeline label for `asap` is "As soon as practical". The e2e note that expects "ASAP" is documentation, not a code change.
- `@netlify/blobs` stays outside the gateway. The site store is used only in live mode. `@openai/agents` is installed and unused (L-6). `analyzeBusiness` does not call a model and does not call `paidAiAllowed`. The gateway still mocks OpenAI unless `OPENAI_API_KEY` is present. The revoked key is not on the lead path.
- A skipped production bake is visible at runtime when the request host is a production host: the response is 503 `lead_mode_mismatch`, not a mock 200. Netlify still does not pass `CONTEXT` into functions. The build command fails closed when that variable is missing. The missing ops email for that mismatch is QA18-F3, still partial (Automate N-7), not a closed item.
- Honeypot and fast-fill responses stay HTTP 200 `{ok:true}` with no CRM write.
- Owner id `94663488`, the owners scope on the live private app, association read-after-write lag, Resend DNS, and a real Netlify scheduled run were not exercised. No external API was called.

## Do not merge without owner approval
