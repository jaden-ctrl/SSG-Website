# Shipley Solutions Group Inc. Website

Production-oriented Next.js website for SSG.

## Website-first release — October 15, 2026

The primary offer is a website project. Navigation: Websites (`/services`), Our Work (`/work`), About (`/about`), Free Website Review (`/audit`), and Discuss Your Website (`/contact`). CRM, automation and local visibility are supporting services. Existing URLs and founder entity IDs remain stable.

The homepage leads with the website offer, practical outcomes, clearly disclosed founder-owned work, the four-stage project process, and a manual review option. No prices, sales results or customer testimonials have been invented. The selected projects are Shipley’s Detailing and Jaden Shipley’s own site.

### Manual website reviews

- `/audit` now presents a **Free Website Review**, personally completed by Jaden with email follow-up. There is no promised turnaround or instant report.
- `AuditForm` uses the shared `LeadForm` with `form_variant: website_review` and `source: manual-website-review`.
- Requests go to `/api/lead`, which creates or updates a HubSpot contact and records the site URL, requested improvements, consent and manual follow-up instructions in the Message property.
- A confirmed CRM write is required before the form reports success. The form preserves entered data on failure. The existing optional webhook remains in use when configured.
- `/api/audit` POST returns HTTP 410 with an instruction to refresh and request the personal review. It no longer imports the agent, creates audit cases or invokes AI.
- Historical case and staff-review code is retained for existing records. It is not part of the new intake. A future automated audit requires a separate explicit implementation decision.
- `HUBSPOT_ACCESS_TOKEN` is required for both live intake forms. OpenAI and SSGAI variables are not required for either form.

## Production design baseline — October 6, 2026

The public website uses the pre-Atlas design from August 26, 2026, commit `0fc915324263efe000b9ac9629dc7ea15dd23ae9` (`restored-08-26-design`), with the October 6 founder section and Organization/Person schema retained.

The owner has repeatedly requested removal of Atlas from the public website. Do not reintroduce Atlas branding, brain graphics, holograms, or their cinematic effects without a new explicit request. The retired visual components and styles have been removed. Public audit copy uses plain SSG language; internal audit processing remains separate.

`npm run build` checks public page/component source and asset names for the retired presentation before building. Keep this check enabled when merging older branches. The earlier restore PR also contains separate Atlas backend work; do not merge that backend project as part of a visual rollback.

Preserve the About page’s “Founded by Jaden Shipley” section, its direct `https://jadenshipley.com/` link, and the shared entity IDs `https://jadenshipley.com/#jaden` and `https://shipleysolutionsgroup.com/#organization`.

## Lead capture / HubSpot CRM

The Start a Conversation form submits to `/api/lead`. Its working HubSpot behavior is intentionally preserved in V4.

The API now sends leads directly into HubSpot Contacts:
- Creates a contact when the email is new.
- Updates the existing contact when the email already exists.
- Maps first name, last name, email, phone, company and website to standard HubSpot contact properties.
- Writes the full audit/project intake, lead source and UTM attribution into HubSpot's standard `Message` contact property.
- Returns an error to the website if HubSpot is not configured or rejects the submission, so the site no longer displays a false success message.

### HubSpot setup

Create a HubSpot private app/access token with these scopes:
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`

Do not put the token into the source code or commit it to GitHub.

In Netlify:
1. Open the SSG project.
2. Go to Project configuration / Environment variables.
3. Add `HUBSPOT_ACCESS_TOKEN` and paste the token as the value.
4. Save it.
5. Trigger a new production deploy.
6. Submit a test Project Inquiry.
7. Confirm the contact appears in HubSpot.

## Historical V4 release

- Mobile-safe SSG Growth System presentation.
- Functional accessible mobile navigation.
- Expanded About, Why SSG, approach and outcome messaging.
- Visual Free Audit-to-growth customer journey.
- Scroll-progressive seven-stage operating framework.
- Restrained reveal, stagger, timeline and metric animations with reduced-motion support.

### Optional secondary webhook

Set `LEAD_WEBHOOK_URL` in Netlify if you also want successful HubSpot submissions forwarded to Make, Zapier, n8n, GoHighLevel, Slack, or another endpoint.

## Stack
- Next.js 15 / React 19
- TypeScript
- Plain CSS
- Lucide icons
- HubSpot CRM lead integration
- UTM/source capture

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For local HubSpot form testing, copy `.env.example` to `.env.local` and insert your token there. Never commit `.env.local`.


## Historical SSGAI variables

Retained backend code may reference these variables. They are not required by the current manual review or project inquiry forms:

- `OPENAI_API_KEY`
- `SSGAI_REVIEW_TOKEN`
- `SSGAI_AGENT_RELEASE_ID` (use an immutable release ID in production)

Optional values are documented in `.env.example`. The temporary reviewer API is `POST /api/admin/reviews`; place it behind SSG staff identity and role authorization before broad production use.
