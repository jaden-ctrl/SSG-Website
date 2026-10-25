import { NextRequest, NextResponse } from 'next/server';
import { LiveTestBlockedError } from '@/lib/gateway';
import { acceptLead } from '@/lib/lead/intake';
import { currentDecision, hostFromHeaders, modeLabel, runWithRequestHost } from '@/lib/runtime-mode';

function leadResponse(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { 'X-SSG-Lead-Mode': modeLabel(currentDecision()), ...extra },
  });
}

export async function POST(req: NextRequest) {
  return runWithRequestHost(hostFromHeaders(req.headers), () => handleLeadPost(req));
}

async function handleLeadPost(req: NextRequest) {
  const decision = currentDecision();
  console.info(JSON.stringify({ event: 'lead_runtime_mode', mode: decision.block ? 'blocked' : decision.mode }));
  if (decision.block) {
    console.error(JSON.stringify({ event: 'lead_live_test_blocked', reason: decision.block }));
    return leadResponse({ ok: false, error: 'Lead system is not configured yet.' }, 503);
  }

  try {
    const result = await acceptLead(await req.text(), req.headers.get('content-length'), req.headers);
    const extra = result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : undefined;
    return leadResponse(result.body, result.status, extra);
  } catch (error) {
    if (error instanceof LiveTestBlockedError) {
      console.error(JSON.stringify({ event: 'lead_live_test_blocked', reason: 'production_portal' }));
      return leadResponse({ ok: false, error: 'Lead system is not configured yet.' }, 503);
    }
    console.error('Lead submission error:', error instanceof Error ? error.name : 'unknown');
    return leadResponse({ ok: false, error: 'Lead submission failed' }, 502);
  }
}
