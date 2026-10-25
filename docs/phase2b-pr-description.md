# Phase 2B lead automation

Do not merge without owner approval. This file is the draft pull request description. It is not an open pull request.

## Summary

`/contact` and `/audit` still post to `/api/lead`. Capture stays on when `LEAD_AUTOMATION_ENABLED` is anything other than the exact string `true`. When the flag is `true`, the site creates one open follow-up task per contact, writes a note, associates a company only from a business email domain, and sends an internal notification. HubSpot workflows are not used.

Owner decisions in this revision:

- QA-2B-09: the company comes from the **email domain**. A free or consumer mailbox (Gmail, Yahoo, Outlook/Hotmail, iCloud, AOL, Proton, and the rest of the free-mail list) does **not** attach the company behind a typed website. The typed website stays on the contact only. This replaces the earlier website-first behavior.
- QA-2B-16: the legacy SSGAI lead webhook is removed. `LEAD_WEBHOOK_URL` stays off unless it is https, `LEAD_WEBHOOK_AUTHORIZED` is exactly `true`, and the secret is at least 32 characters. It still runs only in production live mode, and delivery is scheduled after the visitor response.

## Isolation design

Live HubSpot, Resend, SMTP, and the lead webhook require all of the following:

1. The build bakes `SSG_BUILD_CONTEXT` as `production` only when `CONTEXT` is exactly `production` (case-sensitive). On Netlify (`NETLIFY=true`), a missing or unrecognized `CONTEXT` — including `Production` — exits **1** with `build_context_invalid` and does not write the bake file. Recognized non-production values are `deploy-preview`, `branch-deploy`, and `dev`. `netlify.toml` sets the build command to `npm run build` and `NODE_VERSION` to 22.
2. The request `Host` is on `LEAD_PRODUCTION_HOSTS`. The default list is `shipleysolutionsgroup.com`, `www.shipleysolutionsgroup.com`, and `ssg-site.netlify.app` (the production deploy's own Netlify address). `X-Forwarded-Host` is used only when it equals `Host`. A broken or empty allowlist cannot remove those three hosts from the fail-closed set.
3. Mock mode and live-test mode never run on a production host. That includes a non-production bake on the apex and `LEAD_LIVE_TEST=true` on `ssg-site.netlify.app`. The response is **503** `{ok:false, code}` (`lead_mode_mismatch` or `lead_live_test_on_prod_host`), with a loud log and a rate-limited ops alert. The form shows an error.
4. A runtime `CONTEXT`, when one is actually present and is not `production`, forces the request off the production path. It cannot promote a preview build.

`LEAD_LIVE_TEST=true` is the only non-production opt-in, and it is refused on every production host. Elsewhere it uses `HUBSPOT_TEST_ACCESS_TOKEN` and never `HUBSPOT_ACCESS_TOKEN`. Before any HubSpot write, live mode and live-test mode both read account-info through the gateway. Live mode must see portal `246622244`. Live-test must match `HUBSPOT_TEST_PORTAL_ID` and must not be `246622244`. A mismatch or an unreadable response does not write. The verified portal is cached per token for 10 minutes. The proof is recognized by `GET /account-info/v3/details` with no body. A caller-supplied purpose field cannot skip it.

All of those calls go through `lib/gateway.ts`. Preview and branch deploys use an in-memory blob store. Live-test uses a deploy-scoped store named `{name}--livetest`. Production uses the site store only in live mode.

## Production success rule

On a production host, HTTP 2xx `{ok:true}` is returned only when one of these is true:

- The contact was written with the production token after account-info proved portal `246622244`.
- The site store has both the submission record (`sub/`) and its retry entry (`queue/`), so a later run can finish the write.

Every other production path is non-2xx `{ok:false, code}` and the form shows an error. The only 2xx without a lead record is honeypot or fast-fill spam (`spam/` marker, zero HubSpot calls). A production host never writes with the test token or to the test portal.

If HubSpot is down and the store is up, the lead is queued and the response is 200 `{status:"queued"}`. If the store is down and HubSpot verified the contact, the response is 200. If both are down, the response is **502** `lead_store_unavailable`. A portal mismatch is **503** `lead_portal_mismatch`: nothing is written, and the lead stays queued when the store is up. An invalid `LEAD_STORE_KEY` is logged as `lead_store_key_invalid`, treated as non-durable, and can return 200 only after a verified HubSpot save.

A repeated submission does not create a second contact or a second open follow-up task. The same `client_submission_id` (double-click or timeout retry) reuses the stored record. The same email with a new id upserts the contact and appends the open task.

The retry loop isolates each record. A corrupt or undecryptable record is dead-lettered with `lead_poison_record` and does not stop the others. Other failures use the existing backoff and `LEAD_MAX_ATTEMPTS`, then `lead_dead_letter`, with an alert. Housekeeping still runs. Recovery: `GET` and `POST /api/admin/lead-dlq` with `Authorization: Bearer $SSGAI_REVIEW_TOKEN`, or `node --experimental-strip-types --import ./tests/register.mjs scripts/lead-dlq.ts list|requeue <subKey>`. Requeue clears the attempt count and puts the record back on `queue/`. A poison payload stays isolated until the store key matches.

## Error codes

Non-2xx lead responses are `{ok:false, code, error}`. The same `code` is written on the log event.

| Code | When |
|---|---|
| `lead_mode_mismatch` | Mock mode on a production host, or a production bake that resolved to mock. |
| `lead_live_test_on_prod_host` | `LEAD_LIVE_TEST=true` on a production host. |
| `lead_live_test_blocked` | Live-test portal proof failed (production portal, missing test credentials, or unreadable account-info). |
| `lead_portal_mismatch` | Live token's account-info portal is not `246622244`. No CRM write. |
| `lead_portal_unverified` | Live account-info could not be read and the lead was not durable. |
| `lead_hubspot_unconfigured` | Live mode without `HUBSPOT_ACCESS_TOKEN`. |
| `lead_store_unavailable` | Store write failed, or the store key is missing/invalid and HubSpot did not verify the contact. |
| `lead_store_key_invalid` | Log and ops alert when `LEAD_STORE_KEY` is set but is not 32-byte base64. The HTTP code is `lead_store_unavailable` if the contact was not verified. |
| `lead_partial_nondurable` | The shared store failed after the contact was saved and a later step did not finish. |
| `lead_not_saved` | Live mode finished with neither a verified contact nor a durable queue. |
| `lead_duplicate` | The same submission was already stored but was not saved or queued. A truthful duplicate is 200 `{status:"duplicate", code:"lead_duplicate"}`. |
| `lead_invalid` / `lead_invalid_body` / `lead_body_too_large` / `lead_rate_limited` | Form, JSON, size, and rate-limit rejections. |
| `lead_submission_failed` | Unexpected handler error. |
| `lead_poison_record` | Retry item could not be decrypted or parsed. Dead-lettered. |
| `lead_retry_item_failed` | One retry item failed and was rescheduled. |
| `lead_dead_letter` | Attempt budget exhausted, or a poison record was quarantined. |
| `lead_retry_skipped` | The scheduled function returned because mode was mock or blocked. |
| `lead_ops_alert` | Rate-limited ops alert (10 minutes per code). Email is sent only when the mailer can send; mock mode logs only. |
| `build_context_invalid` | Netlify build exited because `CONTEXT` was missing or not a recognized value. |
| `lead_admin_unauthorized` / `lead_not_found` | Dead-letter admin route. |

## Production env vars

Set these on the production deploy before turning automation on. Do not copy the production HubSpot token onto preview or branch deploys.

| Variable | Notes |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | Private app token. The app needs `crm.objects.owners.read` in addition to the contact, company, note, and task scopes. Without the owners scope, tasks are blocked and an alert is sent; the contact is still saved. |
| `HUBSPOT_DEFAULT_OWNER_ID` | Numeric owner id. Unassigned tasks are not created. |
| `HUBSPOT_PORTAL_ID` | `246622244` for record links. |
| `LEAD_AUTOMATION_ENABLED` | Exact `true` to create tasks, notes, company links, and notifications. |
| `LEAD_STORE_KEY` | 32-byte key, base64. A missing key is non-durable: 200 only after a verified HubSpot save, otherwise 502. An invalid key is logged as `lead_store_key_invalid` and treated the same way. |
| `LEAD_HASH_SALT` | At least 32 characters. If it is missing, rate limiting fails open and a warning names `LEAD_HASH_SALT`. That warning is a log, not an email, so a missing salt does not send a message on every submission. |
| `LEAD_PRODUCTION_HOSTS` | Defaults to the apex, www, and `ssg-site.netlify.app`. Mock and live-test on any of those hosts return 503. A custom list can add hosts. It cannot remove the three defaults from the fail-closed set. |
| `RESEND_API_KEY` | Send-only key. |
| `NOTIFY_EMAIL_TO` | Internal recipients. |
| `NOTIFY_EMAIL_FROM` | An address on `@shipleysolutionsgroup.com`, for example `SSG <notify@shipleysolutionsgroup.com>`. |

Resend domain authentication (SPF and DKIM) and a delivery test are required before activation. This change does not turn sending on and does not hard-code a from address. No live email was sent from this branch.

Leave `LEAD_WEBHOOK_URL` empty until the destination is separately authorized. Webhook delivery uses a 3 second timeout and is not on the visitor request path. The scheduled function can retry a 5xx with the same event id. A 4xx other than 408 or 429 is not retried and alerts.

Live-test, if used, also needs `LEAD_LIVE_TEST=true`, `HUBSPOT_TEST_ACCESS_TOKEN`, `HUBSPOT_TEST_PORTAL_ID` (not `246622244`, and the same portal the token belongs to), `HUBSPOT_TEST_DEFAULT_OWNER_ID`, `RESEND_TEST_API_KEY`, `NOTIFY_EMAIL_TEST_TO`, and `NOTIFY_EMAIL_TEST_FROM`. Dead-letter and owner alerts in live-test go to the test recipient, not `NOTIFY_EMAIL_TO`.

Node is 22 (`engines` `>=22.6.0 <23`, `.nvmrc`, `NODE_VERSION` in `netlify.toml`). CI job `test-and-build` runs `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build` on pull requests and on pushes to `main`.

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

## Known lower-severity issues

| Id | Severity | Handling or justification | Owner |
|---|---|---|---|
| QA14-N1 | Note | Whether the private app can read `/account-info/v3/details` is unverified. If it cannot, live and live-test fail closed (no CRM write). Confirm on the authorized test portal before enabling live-test. | Owner |
| QA-2B-15 | Note | It is unverified whether Netlify puts the custom domain in `Host`. If it does not, production leads return 503 instead of a silent success. Confirm on the first production deploy. | Owner |
| QA-2B-19 | Low | A missing `LEAD_HASH_SALT` still fails open and logs `lead_ratelimit_unavailable`. The salt must be set before production traffic. | Owner |
| Permalink host | Low | A deploy permalink such as `<hash>--ssg-site.netlify.app` is not in the default production-host set. Preview permalinks use the same shape, so they stay mock. A skipped bake on the production permalink can still return a mock 200. Visitors do not normally use that URL. | Owner |
| Honeypot / fast fill | Info | HTTP 200 `{ok:true}` with a `spam/` marker and zero HubSpot calls. This is the only 2xx allowed without a lead record, so a bot is not told it was rejected. The form shows success. | Accepted |
| OpenAI SDK | Low | `analyzeBusiness` no longer calls a model: paid AI stays behind `paidAiAllowed`, and `lib/gateway.ts` mocks OpenAI unless `OPENAI_API_KEY` is set in live mode. The revoked key is not on the lead path. `@openai/agents` is still installed because the preview isolation test imports the mock audit. | Owner, if the package should be deleted |
| FS-F3 follow-up | Low | When the shared store throws, a saved contact whose later steps did not finish returns 502 `lead_partial_nondurable` so the form shows an error. The client retry upserts the same contact and task. | Accepted |

## Not treated as code defects

- A-S1: `jadenshipley.com` links in `app/about/page.tsx` and `app/layout.tsx` are already on main. The harness also matched the word "webhooks." in a comment; that comment no longer says it.
- The harness `tsc` TS2339 errors at `lib/lead/intake.ts` come from `tsconfig.qa.json` with `strict:false`. The repo typecheck is strict.
- QA-2B-11: the public timeline label for `asap` is "As soon as practical". The e2e note that expects "ASAP" is documentation, not a code change.
- OpenAI's SDK `fetch` and `@netlify/blobs` stay outside the gateway. Both are still gated (paid AI only in production live mode; blobs never use the production store in mock or live-test).
- A skipped production bake is visible at runtime when the request host is a production host: the response is 503 `lead_mode_mismatch`, not a mock 200. Netlify still does not pass `CONTEXT` into functions. The build command fails closed when that variable is missing.
- Honeypot and fast-fill responses stay HTTP 200 `{ok:true}` with no CRM write.
- Owner id `94663488`, the owners scope on the live private app, association read-after-write lag, Resend DNS, and a real Netlify scheduled run were not exercised. No external API was called.

## Do not merge without owner approval
