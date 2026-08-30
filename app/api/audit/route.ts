import { handleAuditSubmit } from "@/lib/audit/submit-handler";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = handleAuditSubmit;
