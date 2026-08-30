import { handleAuditCase } from "@/lib/audit/case-handler";

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  return handleAuditCase(request, (await params).caseId);
}
