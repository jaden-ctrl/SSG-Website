import { NextRequest, NextResponse } from 'next/server';

const HUBSPOT_BASE = 'https://api.hubapi.com';

type LeadPayload = Record<string, unknown> & {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  website?: string;
  source?: string;
  form_variant?: string;
  message?: string;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildHubSpotMessage(body: LeadPayload) {
  const variant = text(body.form_variant);
  const source = text(body.source);
  const lines: string[] = [
    `SSG website submission: ${source || variant || 'website'}`,
    `Submitted: ${new Date().toISOString()}`,
  ];

  if (variant === 'audit') {
    lines.push(
      `Primary growth concern: ${text(body.growth_concern) || 'Not provided'}`,
      `Approx. monthly lead volume: ${text(body.monthly_leads) || 'Not provided'}`,
      `Current lead flow: ${text(body.lead_flow) || 'Not provided'}`,
      `Biggest leak: ${text(body.message) || 'Not provided'}`,
    );
  } else {
    lines.push(
      `Project type: ${text(body.project_type) || 'Not provided'}`,
      `Target timeline: ${text(body.timeline) || 'Not provided'}`,
      `Estimated investment: ${text(body.budget) || 'Not provided'}`,
      `Desired outcome: ${text(body.message) || 'Not provided'}`,
    );
  }

  const attribution = [
    ['Landing page', body.landing_page],
    ['UTM source', body.utm_source],
    ['UTM medium', body.utm_medium],
    ['UTM campaign', body.utm_campaign],
  ].filter(([, value]) => text(value));

  if (attribution.length) {
    lines.push('', 'Attribution:');
    for (const [label, value] of attribution) lines.push(`${label}: ${text(value)}`);
  }

  return lines.join('\n');
}

async function hubspotFetch(path: string, token: string, init: RequestInit) {
  return fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const email = text(body.email).toLowerCase();
  const firstName = text(body.first_name);

  if (!email || !firstName) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.error('HUBSPOT_ACCESS_TOKEN is not configured.');
    return NextResponse.json(
      { ok: false, error: 'Lead system is not configured yet.' },
      { status: 503 },
    );
  }

  const properties: Record<string, string> = {
    firstname: firstName,
    email,
    message: buildHubSpotMessage(body),
  };

  const optionalProperties: Array<[string, unknown]> = [
    ['lastname', body.last_name],
    ['phone', body.phone],
    ['company', body.company],
    ['website', body.website],
  ];

  for (const [key, value] of optionalProperties) {
    const cleaned = text(value);
    if (cleaned) properties[key] = cleaned;
  }

  try {
    const search = await hubspotFetch('/crm/v3/objects/contacts/search', token, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
          },
        ],
        properties: ['email'],
        limit: 1,
      }),
    });

    if (!search.ok) {
      const detail = await search.text();
      console.error('HubSpot contact search failed:', search.status, detail);
      return NextResponse.json({ ok: false, error: 'CRM search failed' }, { status: 502 });
    }

    const searchData = await search.json();
    const existingId = searchData?.results?.[0]?.id as string | undefined;

    let hubspotResponse: Response;
    let action: 'created' | 'updated';

    if (existingId) {
      action = 'updated';
      hubspotResponse = await hubspotFetch(`/crm/v3/objects/contacts/${existingId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
    } else {
      action = 'created';
      hubspotResponse = await hubspotFetch('/crm/v3/objects/contacts', token, {
        method: 'POST',
        body: JSON.stringify({ properties }),
      });
    }

    if (!hubspotResponse.ok) {
      const detail = await hubspotResponse.text();
      console.error('HubSpot contact write failed:', hubspotResponse.status, detail);
      return NextResponse.json({ ok: false, error: 'CRM rejected lead' }, { status: 502 });
    }

    const hubspotData = await hubspotResponse.json();

    const webhook = process.env.LEAD_WEBHOOK_URL;
    if (webhook) {
      const webhookResponse = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          submitted_at: new Date().toISOString(),
          hubspot_contact_id: hubspotData?.id,
          hubspot_action: action,
        }),
        cache: 'no-store',
      });
      if (!webhookResponse.ok) {
        console.warn('Optional lead webhook failed:', webhookResponse.status);
      }
    }

    return NextResponse.json({ ok: true, action, contactId: hubspotData?.id });
  } catch (error) {
    console.error('Lead submission error:', error);
    return NextResponse.json({ ok: false, error: 'Lead submission failed' }, { status: 502 });
  }
}
