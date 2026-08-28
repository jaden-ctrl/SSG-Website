# Atlas Agent V1

Atlas V1 is the backend AI architect for Shipley Solutions Group. This build deliberately excludes website visuals and does not yet include the authoritative SSG Brain.

## Current role

Atlas acts as an AI architect, operator, advisor, and reviewer. It converts an objective into a structured operating decision containing an assessment, recommended decision, rationale, action sequence, risks, unknowns, and explicit approval requirements.

## Authority boundary

Atlas operates under delegated authority. Human owner authority remains above Atlas. Material financial, legal, production, security, governance, reputation, or permission-changing actions must be marked for owner approval. Atlas must never claim an external action occurred unless a connected tool actually performed it.

## SSG Brain integration

`lib/atlas/brain.ts` is the integration seam for the latest authoritative SSG Brain. It is intentionally set to `pending` in V1. When the current Brain is supplied, load it there or replace the placeholder with a governed retrieval layer. Atlas must not invent missing Brain doctrine while the Brain is absent.

## Runtime

- Agent runtime: `lib/atlas/agent.ts`
- Base instructions: `lib/atlas/instructions.ts`
- Structured schemas: `lib/atlas/schema.ts`
- Protected API: `app/api/atlas/route.ts`

The agent uses `@openai/agents` and defaults to `gpt-5.6` through `ATLAS_MODEL`.

## Environment

Required for live runs:

- `OPENAI_API_KEY`
- `ATLAS_INTERNAL_TOKEN`

Optional:

- `ATLAS_MODEL` (default `gpt-5.6`)
- `ATLAS_MAX_TURNS` (default `6`)

## API contract

`GET /api/atlas` returns a non-secret readiness/status payload.

`POST /api/atlas` requires `Authorization: Bearer <ATLAS_INTERNAL_TOKEN>` and JSON shaped like:

```json
{
  "message": "Design the operating system for onboarding a new web-development client.",
  "mode": "architect",
  "context": {
    "constraint": "Owner approval required before client delivery"
  }
}
```

The response is validated against the Atlas structured-output schema before it is returned.

## Next build step

Attach the latest governed SSG Brain, then add the first real tool layer and approval workflow. Keep external side effects disabled until each tool has an explicit risk classification and approval policy.
