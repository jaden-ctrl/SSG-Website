import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.email || !body?.first_name) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, submitted_at: new Date().toISOString() }),
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: 'CRM webhook rejected lead' }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
