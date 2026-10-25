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

If HubSpot is down and the store is up, the lead is queued and the response is 200 `{status:"queued"}`. If the store is down and HubSpot verified the contact, the response is 200. If the store is down and a later step did not finish, the response is **502** `lead_partial_nondurable`. **If both the site store and HubSpot are down, the response is 503 `lead_live_test_blocked`** (D-97, P-105/107/109). That is a non-2xx failure. The label is the live-test block code; see L-1. It is not 502 `lead_store_unavailable`.

A portal mismatch is **503** `lead_portal_mismatch`: nothing is written. When the store is up, the lead stays queued. **On each later retry, a portal error is logged and left in place. Attempts are not increased, and the record is not dead-lettered.** The state stays `processing`. The visitor already received 503. There are zero CRM writes. The record completes once the token is fixed. It does not appear in the dead-letter list, and the ops alert fires at intake only (L-3, R8b).

An invalid `LEAD_STORE_KEY` is logged and alerted as `lead_store_key_invalid` and is non-durable. A missing key in live mode is logged as `lead_store_unavailable`. **With HubSpot down, an unset or invalid key returns 503 `lead_portal_unverified`** (C-93/94, L-2), not 502. The response is 200 only after a verified HubSpot save.

A repeated submission does not create a second contact or a second open follow-up task. The same `client_submission_id` (double-click or timeout retry) reuses the stored record. The same email with a new id upserts the contact and appends the open task.

The retry loop isolates each record. A corrupt or undecryptable record is dead-lettered with `lead_poison_record` and does not stop the others. Other failures use the existing backoff and `LEAD_MAX_ATTEMPTS`, then `lead_dead_letter`, with an alert. Housekeeping still runs. Portal errors are the exception in the previous paragraph: they stay queued and do not consume the attempt budget. Recovery: `GET` and `POST /api/admin/lead-dlq` with `Authorization: Bearer $SSGAI_REVIEW_TOKEN`, or `node --experimental-strip-types --import ./tests/register.mjs scripts/lead-dlq.ts list|requeue <subKey>`. Requeue clears the attempt count and puts the record back on `queue/`. A poison payload stays isolated until the store key matches. The settle-path dead-letter marker records reason `attempts` and has no `code` field (I-1).

## Error codes

Non-2xx lead responses are `{ok:false, code, error}`. The same `code` is written on the log event.

| Code | When |
|---|---|
| `lead_mode_mismatch` | Mock mode on a production host, or a production bake that resolved to mock. |
| `lead_live_test_on_prod_host` | `LEAD_LIVE_TEST=true` on a production host, including the apex when that flag is set in the Production environment. |
| `lead_live_test_blocked` | Live-test portal proof failed (production portal, missing test credentials, or unreadable account-info). **Also returned in production live mode when the store is down and the portal is unverified** (both stores down). Safe, and the label is shared with the live-test block (L-1). |
| `lead_portal_mismatch` | Live token's account-info portal is not `246622244`. No CRM write. A queued copy is retried forever until the token is fixed (L-3). |
| `lead_portal_unverified` | Live account-info could not be read and the lead was not durable. This is also the HTTP code when `LEAD_STORE_KEY` is unset or invalid and HubSpot is down (L-2). |
| `lead_hubspot_unconfigured` | Live mode without `HUBSPOT_ACCESS_TOKEN`. |
| `lead_store_unavailable` | Log when the store write failed, or when the live key is missing. HTTP **502** when the contact was not verified on a path that did not fail the portal proof. Both-stores-down on the live path is **503** `lead_live_test_blocked`, not this code. |
| `lead_store_key_invalid` | Log and ops alert when `LEAD_STORE_KEY` is set but is not 32-byte base64. The store is treated as unavailable. **HTTP is 503 `lead_portal_unverified` when HubSpot is down.** HTTP is 200 only after a verified HubSpot save. |
| `lead_partial_nondurable` | The shared store failed after the contact was saved and a later step did not finish. HTTP 502. |
| `lead_not_saved` | Live mode finished with neither a verified contact nor a durable queue. HTTP 502. |
| `lead_duplicate` | The same submission was already stored but was not saved or queued. A truthful duplicate is 200 `{status:"duplicate", code:"lead_duplicate"}`. |
| `lead_invalid` / `lead_invalid_body` / `lead_body_too_large` / `lead_rate_limited` | Form, JSON, size, and rate-limit rejections. |
| `lead_submission_failed` | Unexpected handler error. HTTP 502. |
| `lead_poison_record` | Retry item could not be decrypted or parsed. Dead-lettered. |
| `lead_retry_item_failed` | One retry item failed and was rescheduled. |
| `lead_dead_letter` | Attempt budget exhausted, or a poison record was quarantined. Portal mismatches do not reach this code (L-3). |
| `lead_retry_skipped` | The scheduled function returned because mode was mock or blocked. |
| `lead_ops_alert` | Rate-limited ops alert (10 minutes per code). Email is sent only when the mailer can send and the mode is not mock or blocked. Mock and blocked modes log only, so a skipped bake produces no ops email (I-2). |
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
| `LEAD_STORE_KEY` | 32-byte key, base64. A missing or invalid key is non-durable. **HubSpot down: 503 `lead_portal_unverified`.** An invalid key is logged as `lead_store_key_invalid`. HTTP 200 only after a verified HubSpot save. |
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
| L-1 | Low | `lead_live_test_blocked` is also emitted in production live mode when the store is down and the portal is unverified (D-97, P-105/107/109). The response is non-2xx. Documented here. A later change can relabel it `lead_portal_unverified` or `lead_store_unavailable`. | Follow-up |
| L-2 | Low | Store key unset or invalid, with HubSpot down, returns **503** `lead_portal_unverified`. This description now says 503. | Documented |
| L-3 | Low | Portal errors in `runDue` never bump attempts and never dead-letter. State stays `processing`. Harmless: 0 writes, the visitor got 503, and the record completes once the token is fixed (R8b). Invisible to the dead-letter list. Alerts only at intake. | Follow-up: count attempts or alert |
| L-4 | Low | A custom `LEAD_PRODUCTION_HOSTS` **replaces** the live allowlist. The apex, www, and `ssg-site.netlify.app` stay fail-closed. Omitting `ssg-site.netlify.app` makes that host 503, not live. Documented here. | Documented |
| L-5 | Low | The portal-proof cache allows writes for up to 10 minutes after a portal change (R9: 5 writes, then 503). Accepted and documented. | Accepted |
| L-6 | Low | `@openai/agents` is a dead dependency. Nothing imports it. `analyzeBusiness` always returns the mock audit and does not call `paidAiAllowed`. Remove the package in a follow-up. Do not remove it in a docs-only change. | Follow-up removal |
| L-7 | Low | CI (`.github/workflows`) has no `permissions:` block, so the default token scope applies. Actions are tag-pinned (`@v4`), not SHA-pinned. CI does not exercise the `NETLIFY=true` guard; developer tests do. Follow-up: `permissions: contents: read` and SHA-pin. | Follow-up |
| L-8 | Low | There is no `.gitignore`. That risks committing `.env*`, `.next/`, or `node_modules/`. Add one in a follow-up. Not added in this docs-only change. | Follow-up |
| I-1 | Info | The settle-path dead-letter marker has no `code` (reason `attempts`). | Accepted |
| I-2 | Info | No ops email in mock or blocked mode. A skipped bake produces logs and the visitor-facing error only. | Accepted |
| I-3 | Info | `LEAD_LIVE_TEST=true` in the Production environment fails the apex closed. Never set it in Production. Preview and branch only. | Owner |
| I-4 | Info | A-PR-03 was not tested. A preview-to-production flip inside one process would keep the cached bake. The bake is fixed per deploy. | Accepted |
| QA14-N1 | Note | Whether the private app can read `/account-info/v3/details` is unverified. If it cannot, live and live-test fail closed (no CRM write). Confirm on the authorized test portal before enabling live-test, and on the production app before production. | Owner |
| QA-2B-15 | Note | It is unverified whether Netlify puts the custom domain in `Host`. If it does not, production leads return 503 instead of a silent success. Confirm on the first production deploy. | Owner |
| QA-2B-17 | Low | With the automation flag unset, no task or email is created. This is now logged as `lead_automation_disabled`. Production must set the flag to exactly `true`. | Owner |
| QA-2B-19 | Low | A missing `LEAD_HASH_SALT` still fails open and logs `lead_ratelimit_unavailable`. The salt must be set (at least 32 characters) before production traffic. | Owner |
| Permalink host | Low | A deploy permalink such as `<hash>--ssg-site.netlify.app` is not in the default production-host set. A production bake on that URL returns 503 `lead_mode_mismatch`. The remaining mock 200 needs a non-production bake on the production deploy, which means bypassing the build guard. Keep permalink and preview visitor access Private. Keep `netlify.toml` under CODEOWNERS and branch protection. | Owner |
| Honeypot / fast fill | Info | HTTP 200 `{ok:true}` with a `spam/` marker and zero HubSpot calls. This is the only 2xx allowed without a lead record, so a bot is not told it was rejected. The form shows success. INV-3 holds. | Accepted |
| FS-F3 follow-up | Low | When the shared store throws after the contact is saved and a later step did not finish, the response is 502 `lead_partial_nondurable` so the form shows an error. The client retry upserts the same contact and task. | Accepted |

### Automate notes N-1 through N-6

SSG Automate's review of `121a9b9` numbered two notes, **QA14-N1** and **FS-N1**. It did not publish a list labelled N-1 through N-6. Quality's retest of `4d1921b` is the source for the residuals below. N-1 and N-2 are the two behaviors this description was asked to disclose. N-3 through N-6 are the other Automate notes that are still open or closed at this commit.

| Id | Severity | What it is | Handling |
|---|---|---|---|
| N-1 | Low | **A portal mismatch on a queued lead retries forever without dead-lettering.** `runDue` catches `LiveTestBlockedError`, logs `lead_portal_mismatch` (or `lead_live_test_blocked` / `lead_portal_unverified`), and continues. It does not call the attempt bump. The record stays `processing`, with `queue/` still present, and it never moves to `dlq/`. The dead-letter list does not show it. The ops alert runs at intake only. Zero CRM writes. The visitor already received 503. The record completes on a later run once the token is corrected (Quality L-3, R8b). | Documented. Follow-up: count attempts or alert on each stuck retry. |
| N-2 | Low | **The cached portal proof lasts up to 10 minutes.** A successful account-info read is stored per token for `PORTAL_CACHE_TTL_MS` (10 minutes). If that token's portal changes, writes continue until the entry expires. Quality measured five writes, then 503 `lead_portal_mismatch` (L-5, R9). Automate QA14-F3 asked for a 10–15 minute TTL because the previous cache did not expire. Failures are not cached. | Accepted and documented. |
| N-3 | Note | **QA14-N1.** The account-info scope is unverified. If the private app cannot `GET /account-info/v3/details`, every live and live-test lead fails closed. Safe, and it would block the live test. | Confirm on the authorized test portal before live-test, and with the production app before production. |
| N-4 | Info | **FS-N1.** `runLeadAutomation` logged `error.message`. `/api/lead` does not call that function. The catch now logs `error.name` as `errorClass`. | Closed in `4d1921b`. |
| N-5 | Note | **QA-2B-15, from Automate's Host check.** `X-Forwarded-Host` is used only when it equals `Host`. Whether Netlify puts the custom domain in `Host` is unverified. A wrong Host is 503, not a false success. | NEEDS LIVE TEST on the first production deploy. |
| N-6 | Info | **B1–B9 and the mock-mode alert limit.** Automate's isolation checklist (secret scopes, rotation, sensitive-variable policy, branch deploys, visitor access, AI Gateway, first-preview mock check) cannot be verified offline. Related: ops email is not sent in mock or blocked mode, so a skipped bake is visible in logs and as a visitor error only (I-2, formerly QA18-F3). | Netlify UI checks stay open. Mock-mode log-only is accepted. |

## Not treated as code defects

- A-S1: `jadenshipley.com` links in `app/about/page.tsx` and `app/layout.tsx` are already on main. The harness also matched the word "webhooks." in a comment; that comment no longer says it.
- The harness `tsc` TS2339 errors at `lib/lead/intake.ts` come from `tsconfig.qa.json` with `strict:false`. The repo typecheck is strict.
- QA-2B-11: the public timeline label for `asap` is "As soon as practical". The e2e note that expects "ASAP" is documentation, not a code change.
- `@netlify/blobs` stays outside the gateway. The site store is used only in live mode. `@openai/agents` is installed and unused (L-6). `analyzeBusiness` does not call a model and does not call `paidAiAllowed`. The gateway still mocks OpenAI unless `OPENAI_API_KEY` is present. The revoked key is not on the lead path.
- A skipped production bake is visible at runtime when the request host is a production host: the response is 503 `lead_mode_mismatch`, not a mock 200. Netlify still does not pass `CONTEXT` into functions. The build command fails closed when that variable is missing. A skipped bake does not send an ops email (I-2).
- Honeypot and fast-fill responses stay HTTP 200 `{ok:true}` with no CRM write.
- Owner id `94663488`, the owners scope on the live private app, association read-after-write lag, Resend DNS, and a real Netlify scheduled run were not exercised. No external API was called.

## Do not merge without owner approval
