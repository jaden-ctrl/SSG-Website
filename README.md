# Shipley Solutions Group Inc. Website — v3

Production-oriented Next.js website for SSG.

## Lead capture / HubSpot CRM

Both website forms submit to `/api/lead`.

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
6. Submit a test Free Audit and Project Inquiry.
7. Confirm both contacts appear in HubSpot.

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
