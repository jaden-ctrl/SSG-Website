import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { openJsonStore } from "@/lib/blob-store";
import { listDeadLetters, requeueDeadLetter } from "@/lib/lead/dlq";

function authorized(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function store() {
  return openJsonStore("lead-intake", { strong: true });
}

/** List dead-lettered leads. Requires SSGAI_REVIEW_TOKEN. Does not return the payload. */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.SSGAI_REVIEW_TOKEN)) {
    return NextResponse.json({ ok: false, code: "lead_admin_unauthorized", error: "Unauthorized" }, { status: 401 });
  }
  const records = await listDeadLetters(store());
  return NextResponse.json({ ok: true, records });
}

/** Requeue one dead-lettered submission by subKey. The next retry run picks it up. */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.SSGAI_REVIEW_TOKEN)) {
    return NextResponse.json({ ok: false, code: "lead_admin_unauthorized", error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "lead_invalid_body", error: "Invalid request body" }, { status: 400 });
  }
  const subKey = body && typeof body === "object" && typeof (body as { subKey?: unknown }).subKey === "string"
    ? (body as { subKey: string }).subKey
    : "";
  if (!subKey || subKey.includes("/") || subKey.length > 128) {
    return NextResponse.json({ ok: false, code: "lead_invalid", error: "Invalid request body" }, { status: 400 });
  }
  const moved = await requeueDeadLetter(store(), subKey);
  if (!moved) return NextResponse.json({ ok: false, code: "lead_not_found", error: "Dead letter not found" }, { status: 404 });
  console.info(JSON.stringify({ event: "lead_dead_letter_requeued", code: "lead_dead_letter_requeued", submission_id: subKey.slice(0, 12) }));
  return NextResponse.json({ ok: true, subKey });
}
