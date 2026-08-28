import { NextRequest, NextResponse } from 'next/server';

type AuditPayload = Record<string, unknown> & {
  email?: string;
  first_name?: string;
  company?: string;
  website?: string;
  growth_concern?: string;
  monthly_leads?: string;
  lead_flow?: string;
  message?: string;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  let body: AuditPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid audit request.' }, { status: 400 });
  }

  const required = {
    firstName: text(body.first_name),
    email: text(body.email),
    company: text(body.company),
    website: text(body.website),
    growthConcern: text(body.growth_concern),
    biggestLeak: text(body.message),
  };

  if (Object.values(required).some((value) => !value)) {
    return NextResponse.json(
      { ok: false, error: 'Please complete all required audit fields.' },
      { status: 400 },
    );
  }

  // The Free Audit is intentionally isolated from /api/lead.
  // This endpoint is reserved for the SSG Brain. When the Brain is ready,
  // this is where its OpenAI/agent call, structured scoring, and result
  // generation will live.
  //
  // Nothing in this route sends the audit to the lead-capture endpoint.

  return NextResponse.json(
    {
      ok: false,
      error: 'Atlas is being configured. The Free Audit will be available soon.',
      code: 'SSG_BRAIN_NOT_CONFIGURED',
    },
    { status: 503 },
  );
}
