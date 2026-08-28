import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runAtlas } from "@/lib/atlas/agent";
import { atlasRequestSchema } from "@/lib/atlas/schema";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.ATLAS_INTERNAL_TOKEN;
  if (!expected) return false;
  const supplied = request.headers.get("authorization");
  return supplied === `Bearer ${expected}`;
}

export async function GET() {
  return NextResponse.json({
    name: "Atlas",
    role: "SSG AI Architect",
    status: "ready",
    brain: "pending-latest-ssg-brain",
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = atlasRequestSchema.parse(await request.json());
    const output = await runAtlas(body);
    return NextResponse.json(output);
  } catch (cause) {
    if (cause instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid Atlas request", fields: cause.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("Atlas run failed", cause);
    return NextResponse.json({ error: "Atlas could not complete the request" }, { status: 500 });
  }
}
