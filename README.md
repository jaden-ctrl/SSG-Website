# Shipley Solutions Group Inc. Website — V4

Production-oriented Next.js website for SSG.

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

## Free Audit / SSG Brain boundary

Free Audit is linked to `/audit`, which renders `components/AuditForm.tsx` and submits only to `/api/audit`. The governed SSGAI flow opens a durable case, creates a draft preview, stops at `QA_PENDING`, and requires an authenticated SSG human review before `PREVIEW_RELEASED`. Only a released audit is projected to HubSpot or the optional automation webhook.

## V4 release

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


## SSGAI deployment variables

Required server-only Netlify variables:

- `OPENAI_API_KEY`
- `SSGAI_REVIEW_TOKEN`
- `SSGAI_AGENT_RELEASE_ID` (use an immutable release ID in production)

Optional values are documented in `.env.example`. The temporary reviewer API is `POST /api/admin/reviews`; place it behind SSG staff identity and role authorization before broad production use.
