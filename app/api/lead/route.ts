import { NextRequest } from 'next/server';
import { handleLeadAdmission } from '@/lib/lead/admission';
import { readBuildContext } from '@/lib/runtime-mode';

export async function POST(req: NextRequest) {
  return handleLeadAdmission(req, readBuildContext());
}
