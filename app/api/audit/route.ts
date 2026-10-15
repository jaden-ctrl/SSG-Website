import { NextResponse } from 'next/server';

// The public automated audit intake is retired. Manual reviews use /api/lead.
// Return an actionable error for older browser tabs without creating a case or calling AI.
export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'Automated audits are unavailable. Please refresh the page and request a personal website review.',
    reviewUrl: '/audit',
  }, { status: 410 });
}
