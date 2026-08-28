import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cases } from "@/lib/cases/repository";
const digest=(value:string)=>createHash("sha256").update(value).digest();
export async function GET(request:Request,{params}:{params:Promise<{caseId:string}>}){const{caseId}=await params;const auth=request.headers.get("authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"",record=await cases.get(caseId);if(!record||!token||!timingSafeEqual(digest(token),Buffer.from(record.accessTokenHash,"hex")))return NextResponse.json({error:"Not found"},{status:404});if(record.state==="PREVIEW_RELEASED")return NextResponse.json({status:"released",audit:record.releasedPreview});if(record.state==="FAILED_RECOVERABLE")return NextResponse.json({status:"held",message:"This case needs SSG follow-up."});return NextResponse.json({status:"pending_review",message:"The preview candidate is awaiting independent SSG review."})}

