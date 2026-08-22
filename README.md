# Shipley Solutions Group Inc. Website

Production-oriented Next.js website built for SSG using the supplied logo and brand palette.

## Stack
- Next.js 15 / React 19
- TypeScript
- Plain CSS (no framework lock-in)
- Lucide icons
- Server API route for CRM/webhook lead forwarding
- UTM/source capture built into forms

## Brand colors
- Electric blue: `#1856FD`
- Charcoal: `#3C4353`
- Near-black: `#0B0D12`
- White: `#FFFFFF`

## Run locally
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## CRM / HubSpot / HighLevel / webhook integration
Copy `.env.example` to `.env.local` and set:
```bash
LEAD_WEBHOOK_URL=https://your-webhook-endpoint.example
```
Every contact/audit submission will be POSTed as JSON to that endpoint. The payload includes contact information, source, landing page, and UTM fields.

This means you can connect the site to:
- HubSpot via a custom webhook/API middleware
- GoHighLevel inbound webhook
- Make
- Zapier
- n8n
- Your own API

## Deployment
Recommended: Vercel.
1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add `LEAD_WEBHOOK_URL` as an environment variable if using CRM forwarding.
4. Point the SSG domain to Vercel.

## Before launch
- Replace `metadataBase` in `app/layout.tsx` if the production domain differs from `shipleysolutionsgroup.com`.
- Add your booking URL if desired.
- Add real case studies/results as they become available.
- Add Privacy Policy / Terms pages before running paid traffic or collecting regulated data.
