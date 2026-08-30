import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ssgai',
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    reviewProtection: 'netlify-identity',
    brainCandidate: 'SSG-BRAIN-020-E1-R0-WC1',
  });
}
