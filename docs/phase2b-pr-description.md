# Phase 2B lead automation

Do not merge without owner approval. This file is the draft pull request description. It is not an open pull request.

## Summary

`/contact` and `/audit` still post to `/api/lead`. Capture stays on when `LEAD_AUTOMATION_ENABLED` is anything other than the exact string `true`. When the flag is `true`, the site creates one open follow-up task per contact, writes a note, associates a company only from a business email domain, and sends an internal notification. HubSpot workflows are not used.

Owner decisions in this revision:

- QA-2B-09: the company comes from the **email domain**. A free or consumer mailbox (Gmail, Yahoo, Outlook/Hotmail, iCloud, AOL, Proton, and the rest of the free-mail list) does **not** attach the company behind a typed website. The typed website stays on the contact only. This replaces the earlier website-first behavior.
- QA-2B-16: the legacy SSGAI lead webhook is removed. `LEAD_WEBHOOK_URL` stays off unless it is https, `LEAD_WEBHOOK_AUTHORIZED` is exactly `true`, and the secret is at least 32 characters. It still runs only in production live mode, and delivery is scheduled after the visitor response.

## Isolation design

Live HubSpot, Resend, SMTP, and the lead webhook require all of the following:

1. The build bakes `SSG_BUILD_CONTEXT` as `production`. `scripts/write-build-context.mjs` writes that only when `CONTEXT` is exactly `production`. The build exits 1 when `CONTEXT` is `production` but the persisted value is not. `netlify.toml` sets the build command to `npm run build` and `NODE_VERSION` to 22.
2. The request `Host` is on `LEAD_PRODUCTION_HOSTS` (default `shipleysolutionsgroup.com` and `www.shipleysolutionsgroup.com`). `X-Forwarded-Host` is used only when it equals `Host`. A production bake that still resolves to mock returns **503** `{ok:false}` and logs `lead_mode_mismatch`. The form shows that error. It does not report a successful capture.
3. A runtime `CONTEXT`, when one is actually present and is not `production`, forces the request off the production path. It cannot promote a preview build.

`LEAD_LIVE_TEST=true` is the only non-production opt-in. It uses `HUBSPOT_TEST_ACCESS_TOKEN` and never `HUBSPOT_ACCESS_TOKEN`. Before any HubSpot write it reads account-info through the gateway. The portal must match `HUBSPOT_TEST_PORTAL_ID` and must not be production portal `246622244`. A mismatch, the production portal, or an unreadable response is **503** with zero writes.

All of those calls go through `lib/gateway.ts`. Preview and branch deploys use an in-memory blob store. Live-test uses a deploy-scoped store named `{name}--livetest`. Production uses the site store only in live mode.

If the durable store and HubSpot both fail, `/api/lead` returns **502** `{ok:false}`. A HubSpot failure after a durable write returns 200 because the lead is queued for the scheduled retry. A honeypot or a too-fast fill returns a generic 200 and does not write to the CRM. That is intentional so the response does not tell a bot it was rejected. The form treats `ok:true` as success only for that generic response, and treats `ok:false` as an error the visitor can see.

## Production env vars

Set these on the production deploy before turning automation on. Do not copy the production HubSpot token onto preview or branch deploys.

| Variable | Notes |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | Private app token. The app needs `crm.objects.owners.read` in addition to the contact, company, note, and task scopes. Without the owners scope, tasks are blocked and an alert is sent; the contact is still saved. |
| `HUBSPOT_DEFAULT_OWNER_ID` | Numeric owner id. Unassigned tasks are not created. |
| `HUBSPOT_PORTAL_ID` | `246622244` for record links. |
| `LEAD_AUTOMATION_ENABLED` | Exact `true` to create tasks, notes, company links, and notifications. |
| `LEAD_STORE_KEY` | 32-byte key, base64. Without it, a HubSpot failure stays a 502 and nothing is queued. |
| `LEAD_HASH_SALT` | At least 32 characters. If it is missing, rate limiting fails open and a warning names `LEAD_HASH_SALT`. That warning is a log, not an email, so a missing salt does not send a message on every submission. |
| `LEAD_PRODUCTION_HOSTS` | Defaults to the apex and www host. A production deploy served from a `netlify.app` hostname is mock, and `/api/lead` returns 503 instead of a fake success. |
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
- QA-2B-18 `netlify.toml` pins the build, the bake fails closed, and a production build that resolves to mock returns an error.
- QA-2B-19 missing `LEAD_HASH_SALT` is logged by name. Rate limit still fails open. Setting the salt in production is still required.
- QA-2B-20 admin reviews use `timingSafeEqual` and `safeParse` (400 for a bad body, 401 for a bad token). The env name remains `SSGAI_REVIEW_TOKEN`.
- QA-2B-21 live-test alerts use the test from/to pair.
- QA-2B-22 Node 22 is pinned and CI runs on it.
- QA-2B-23 the lead webhook is scheduled off the visitor path. Timeout stays 3 seconds.
- QA-2B-24 the scheduled retry import graph uses relative imports so the bundler does not need TypeScript path aliases. Confirming the scheduled function on Netlify still needs a production publish.

Rate-limit env names are `LEAD_RL_IP_PER_10M`, `LEAD_RL_EMAIL_PER_10M`, and `LEAD_RL_GLOBAL_PER_10M` (defaults 5 / 3 / 60). `LEAD_TASK_DEDUPE_DAYS` is not read.

## Not treated as code defects

- A-S1: `jadenshipley.com` links in `app/about/page.tsx` and `app/layout.tsx` are already on main. The harness also matched the word "webhooks." in a comment; that comment no longer says it.
- The harness `tsc` TS2339 errors at `lib/lead/intake.ts` come from `tsconfig.qa.json` with `strict:false`. The repo typecheck is strict.
- QA-2B-11: the public timeline label for `asap` is "As soon as practical". The e2e note that expects "ASAP" is documentation, not a code change.
- OpenAI's SDK `fetch` and `@netlify/blobs` stay outside the gateway. Both are still gated (paid AI only in production live mode; blobs never use the production store in mock or live-test).
- A skipped production bake cannot be detected at runtime, because Netlify does not provide `CONTEXT` to functions. The build command and the bake check cover that. A production URL that is not on the host allowlist now returns 503 rather than a silent mock success.
- Honeypot and fast-fill responses stay HTTP 200 `{ok:true}` with no CRM write.
- Owner id `94663488`, the owners scope on the live private app, association read-after-write lag, Resend DNS, and a real Netlify scheduled run were not exercised. No external API was called.

## Do not merge without owner approval
