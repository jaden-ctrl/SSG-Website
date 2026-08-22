import { NextRequest, NextResponse } from 'next/server';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const REQUEST_TIMEOUT_MS = 10_000;

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
  const isAudit = text(body.form_variant) === 'audit';
  const lines = [
    `SSG website submission: ${text(body.source) || text(body.form_variant) || 'website'}`,
    `Submitted: ${new Date().toISOString()}`,
    isAudit ? `Primary growth concern: ${text(body.growth_concern) || 'Not provided'}` : `Project type: ${text(body.project_type) || 'Not provided'}`,
    isAudit ? `Approx. monthly lead volume: ${text(body.monthly_leads) || 'Not provided'}` : `Target timeline: ${text(body.timeline) || 'Not provided'}`,
    isAudit ? `Current lead flow: ${text(body.lead_flow) || 'Not provided'}` : `Estimated investment: ${text(body.budget) || 'Not provided'}`,
    isAudit ? `Biggest leak: ${text(body.message) || 'Not provided'}` : `Desired outcome: ${text(body.message) || 'Not provided'}`,
  ];

  for (const [label, value] of [
    ['Landing page', body.landing_page],
    ['UTM source', body.utm_source],
    ['UTM medium', body.utm_medium],
    ['UTM campaign', body.utm_campaign],
  ] as const) {
    if (text(value)) lines.push(`${label}: ${text(value)}`);
  }
  return lines.join('\n');
}

async function hubspotFetch(path: string, token: string, init: RequestInit) {
  return fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function parseBody(req: NextRequest): Promise<LeadPayload> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return req.json();
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    return Object.fromEntries((await req.formData()).entries());
  }
  throw new Error('Unsupported content type');
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await parseBody(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  // Netlify honeypot: silently accept bot submissions without creating a CRM record.
  if (text(body['bot-field'])) return NextResponse.json({ ok: true });

  const email = text(body.email).toLowerCase();
  const firstName = text(body.first_name);
  if (!firstName || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'A valid name and email are required' }, { status: 400 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('Lead submission rejected: HUBSPOT_ACCESS_TOKEN is missing.');
    return NextResponse.json({ ok: false, error: 'CRM is not configured' }, { status: 503 });
  }

  const properties: Record<string, string> = {
    firstname: firstName,
    email,
    message: buildHubSpotMessage(body),
  };
  for (const [property, value] of [
    ['lastname', body.last_name], ['phone', body.phone], ['company', body.company], ['website', body.website],
  ] as const) {
    if (text(value)) properties[property] = text(value);
  }

  try {
    const search = await hubspotFetch('/crm/v3/objects/contacts/search', token, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email'], limit: 1,
      }),
    });
    if (!search.ok) {
      console.error('HubSpot search failed:', search.status, await search.text());
      return NextResponse.json({ ok: false, error: 'CRM search failed' }, { status: 502 });
    }

    const existingId = (await search.json())?.results?.[0]?.id as string | undefined;
    const action = existingId ? 'updated' : 'created';
    const writePath = existingId ? `/crm/v3/objects/contacts/${existingId}` : '/crm/v3/objects/contacts';
    const writeMethod = existingId ? 'PATCH' : 'POST';
    let write = await hubspotFetch(writePath, token, {
      method: writeMethod,
      body: JSON.stringify({ properties }),
    });

    // `message` is not writable in every HubSpot portal. Retain the lead by
    // retrying with standard contact properties when that property is rejected.
    if (write.status === 400 && properties.message) {
      const firstFailure = await write.text();
      console.warn('HubSpot rejected the message property; retrying without it:', firstFailure);
      const standardProperties = { ...properties };
      delete standardProperties.message;
      write = await hubspotFetch(writePath, token, {
        method: writeMethod,
        body: JSON.stringify({ properties: standardProperties }),
      });
    }
    if (!write.ok) {
      console.error('HubSpot write failed:', write.status, await write.text());
      return NextResponse.json({ ok: false, error: 'CRM rejected lead' }, { status: 502 });
    }

    const contact = await write.json();
    const webhook = process.env.LEAD_WEBHOOK_URL?.trim();
    if (webhook) {
      try {
        const webhookResponse = await fetch(webhook, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, message_summary: buildHubSpotMessage(body), submitted_at: new Date().toISOString(), hubspot_contact_id: contact.id, hubspot_action: action }),
          cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!webhookResponse.ok) console.warn('Optional lead webhook failed:', webhookResponse.status);
      } catch (error) {
        // An optional webhook must never turn a successful HubSpot write into a failed form submission.
        console.warn('Optional lead webhook error:', error);
      }
    }

    return NextResponse.json({ ok: true, action, contactId: contact.id });
  } catch (error) {
    console.error('Lead submission error:', error);
    return NextResponse.json({ ok: false, error: 'Lead submission failed' }, { status: 502 });
  }
}
