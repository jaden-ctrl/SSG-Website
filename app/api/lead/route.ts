import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { automationEnabled, runLeadAutomationWithBudget, timelineLabel } from '@/lib/hubspot/lead-automation';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const HUBSPOT_TIMEOUT_MS = 8_000;
const WEBHOOK_TIMEOUT_MS = 3_000;

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

  if (variant === 'website_review') {
    lines.push(
      'Request type: Free Website Review — manual follow-up required',
      `Website to review: ${text(body.website)}`,
      `What they want to improve: ${text(body.message)}`,
      'Next action: Jaden personally reviews the website and follows up by email.',
      `Contact permission for this request: ${text(body.consent) === 'true' ? 'Granted' : 'Not provided'}`,
    );
  } else if (variant === 'audit') {
    lines.push(
      `Primary growth concern: ${text(body.growth_concern) || 'Not provided'}`,
      `Approx. monthly lead volume: ${text(body.monthly_leads) || 'Not provided'}`,
      `Current lead flow: ${text(body.lead_flow) || 'Not provided'}`,
      `Biggest leak: ${text(body.message) || 'Not provided'}`,
    );
  } else {
    lines.push(
      `Project type: ${text(body.project_type) || 'Not provided'}`,
      `Target timeline: ${timelineLabel(body.timeline)}`,
      `Estimated investment: ${text(body.budget) || 'Not provided'}`,
      `Desired outcome: ${text(body.message) || 'Not provided'}`,
      `Contact permission for this request: ${text(body.consent) === 'true' ? 'Granted' : 'Not provided'}`,
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
    signal: AbortSignal.timeout(HUBSPOT_TIMEOUT_MS),
  });
}

/** PII-safe summary of a HubSpot error response: status, category and correlationId only. */
async function hubspotErrorSummary(response: Response) {
  try {
    const data = await response.json();
    return { status: response.status, category: data?.category, correlationId: data?.correlationId };
  } catch {
    return { status: response.status };
  }
}

/** HubSpot 409 on create returns "Contact already exists. Existing ID: 123". */
function existingIdFromConflict(message: unknown) {
  const match = typeof message === 'string' ? message.match(/Existing ID:\s*(\d+)/i) : null;
  return match?.[1];
}

function webhookPayload(body: LeadPayload, contactId: unknown, action: string) {
  const submittedAt = new Date().toISOString();
  if (process.env.LEAD_WEBHOOK_MINIMAL !== 'true') {
    // Default keeps the existing payload shape so any current receiver keeps working.
    return { ...body, submitted_at: submittedAt, hubspot_contact_id: contactId, hubspot_action: action };
  }
  return {
    email: text(body.email), first_name: text(body.first_name), last_name: text(body.last_name),
    company: text(body.company), website: text(body.website), form_variant: text(body.form_variant),
    source: text(body.source), submitted_at: submittedAt, hubspot_contact_id: contactId, hubspot_action: action,
  };
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const email = text(body.email).toLowerCase();
  const firstName = text(body.first_name);

  if (!email || !firstName || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  if (text(body.faxNumber)) {
    return NextResponse.json({ ok: false, error: 'Please check the form.' }, { status: 400 });
  }

  // The form requires the consent checkbox for every variant; enforce and record it server-side too.
  if (text(body.consent) !== 'true') {
    return NextResponse.json({ ok: false, error: 'Please confirm we may contact you about this request.' }, { status: 400 });
  }

  if (text(body.form_variant) === 'website_review') {
    if (!text(body.company) || !text(body.message) || text(body.message).length > 3000 || text(body.consent) !== 'true') {
      return NextResponse.json({ ok: false, error: 'Please complete the review request.' }, { status: 400 });
    }
    try {
      const rawWebsite = text(body.website);
      if (!rawWebsite || rawWebsite.length > 500) throw new Error('Invalid website');
      const website = new URL(/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`);
      if (!['http:', 'https:'].includes(website.protocol) || !website.hostname.includes('.') || website.username || website.password) throw new Error('Invalid website');
      body.website = website.href;
    } catch {
      return NextResponse.json({ ok: false, error: 'Please enter a valid website address.' }, { status: 400 });
    }
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
        properties: ['email', 'hubspot_owner_id'],
        limit: 1,
      }),
    });

    if (!search.ok) {
      console.error('HubSpot contact search failed:', JSON.stringify(await hubspotErrorSummary(search)));
      return NextResponse.json({ ok: false, error: 'CRM search failed' }, { status: 502 });
    }

    const searchData = await search.json();
    const existingId = searchData?.results?.[0]?.id as string | undefined;
    const existingOwnerId = (searchData?.results?.[0]?.properties?.hubspot_owner_id as string | undefined) || undefined;

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
      // Fast resubmit race: search index lagged and the contact already exists -> update it instead.
      if (hubspotResponse.status === 409) {
        const conflict = await hubspotResponse.json().catch(() => null);
        const conflictId = existingIdFromConflict(conflict?.message);
        if (conflictId) {
          action = 'updated';
          hubspotResponse = await hubspotFetch(`/crm/v3/objects/contacts/${conflictId}`, token, {
            method: 'PATCH',
            body: JSON.stringify({ properties }),
          });
        }
      }
    }

    if (!hubspotResponse.ok) {
      console.error('HubSpot contact write failed:', JSON.stringify(await hubspotErrorSummary(hubspotResponse)));
      return NextResponse.json({ ok: false, error: 'CRM rejected lead' }, { status: 502 });
    }

    const hubspotData = await hubspotResponse.json();

    // Phase 2B extras: owner, follow-up task, company, note, notification.
    // Runs only after a successful upsert, is fully isolated (never throws) and is
    // a no-op unless LEAD_AUTOMATION_ENABLED=true.
    if (automationEnabled() && hubspotData?.id) {
      await runLeadAutomationWithBudget({
        token,
        contactId: String(hubspotData.id),
        action,
        existingOwnerId,
        email,
        body,
        summary: properties.message,
      });
    }

    const webhook = process.env.LEAD_WEBHOOK_URL?.trim();
    if (webhook) {
      try {
        const payload = JSON.stringify(webhookPayload(body, hubspotData?.id, action));
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = process.env.LEAD_WEBHOOK_SECRET;
        if (secret) headers['X-SSG-Signature'] = createHmac('sha256', secret).update(payload).digest('hex');
        const webhookResponse = await fetch(webhook, {
          method: 'POST',
          headers,
          body: payload,
          cache: 'no-store',
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        if (!webhookResponse.ok) console.warn('Optional lead webhook failed:', webhookResponse.status);
      } catch (error) {
        // An optional webhook must never turn a successful HubSpot write into a failed submission.
        console.warn('Optional lead webhook error:', error instanceof Error ? error.name : 'unknown');
      }
    }

    return NextResponse.json({ ok: true, action, contactId: hubspotData?.id });
  } catch (error) {
    console.error('Lead submission error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: 'Lead submission failed' }, { status: 502 });
  }
}
