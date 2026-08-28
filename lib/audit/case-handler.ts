import { createHash, timingSafeEqual } from "node:crypto";
import { cases, type CaseRepository } from "../cases/repository";

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function handleAuditCase(
  request: Request,
  caseId: string,
  repository: Pick<CaseRepository, "get"> = cases,
) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const record = await repository.get(caseId);
  const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!record || !token || !timingSafeEqual(digest(token), Buffer.from(record.accessTokenHash, "hex"))) return response({ error: "Not found" }, 404);
  if (record.state === "PREVIEW_RELEASED") return response({ status: "released", audit: record.releasedPreview });
  if (record.state === "FAILED_RECOVERABLE" || record.state === "MANUAL_REVIEW") return response({ status: "held", message: "This case needs SSG follow-up." });
  return response({ status: "pending_review", message: "The preview candidate is awaiting independent SSG review." });
}
