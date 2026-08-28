import { createHash, timingSafeEqual } from "node:crypto";
import { cases } from "../cases/repository";

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function handleAuditCase(request: Request, caseId: string) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const record = await cases.get(caseId);
  if (!record || !token || !timingSafeEqual(digest(token), Buffer.from(record.accessTokenHash, "hex"))) return Response.json({ error: "Not found" }, { status: 404 });
  if (record.state === "PREVIEW_RELEASED") return Response.json({ status: "released", audit: record.releasedPreview });
  if (record.state === "FAILED_RECOVERABLE") return Response.json({ status: "held", message: "This case needs SSG follow-up." });
  return Response.json({ status: "pending_review", message: "The preview candidate is awaiting independent SSG review." });
}
