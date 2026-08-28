import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import type { Intake, PartialAudit } from "../schemas";

export type LeadRecord = Intake & { id:string; createdAt:string; status:"received"|"analyzed"|"analysis_failed"; audit?:PartialAudit };
export interface LeadAction { save(record: LeadRecord): Promise<void>; }

class LocalLeadAction implements LeadAction {
  async save(record: LeadRecord) { const dir=path.join(process.cwd(),"data"); await mkdir(dir,{recursive:true}); await appendFile(path.join(dir,"leads.jsonl"),JSON.stringify(record)+"\n","utf8"); }
}
class NetlifyLeadAction implements LeadAction {
  async save(record: LeadRecord) { await getStore("ssgai-leads").setJSON(record.id,record); }
}
class WebhookLeadAction implements LeadAction {
  constructor(private url:string) {}
  async save(record:LeadRecord) { const r=await fetch(this.url,{method:"POST",headers:{"content-type":"application/json",...(process.env.SSGAI_LEAD_WEBHOOK_SECRET?{"authorization":`Bearer ${process.env.SSGAI_LEAD_WEBHOOK_SECRET}`}:{})},body:JSON.stringify(record),signal:AbortSignal.timeout(8000)}); if(!r.ok) throw new Error(`Lead webhook failed (${r.status})`); }
}

async function syncHubSpot(record:LeadRecord) {
  if(!process.env.HUBSPOT_ACCESS_TOKEN) return;
  const properties={email:record.email,firstname:record.firstName,lastname:record.lastName,company:record.company,website:record.website||undefined,hs_lead_status:"NEW"};
  const r=await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert",{method:"POST",headers:{authorization:`Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({inputs:[{idProperty:"email",id:record.email,properties}]}),signal:AbortSignal.timeout(8000)});
  if(!r.ok) throw new Error(`HubSpot sync failed (${r.status})`);
}

export async function captureLead(record:LeadRecord) {
  const primary:LeadAction = process.env.NETLIFY ? new NetlifyLeadAction() : new LocalLeadAction();
  await primary.save(record);
}

export async function projectReleasedLead(record:LeadRecord) {
  const optional = [syncHubSpot(record),...(process.env.SSGAI_LEAD_WEBHOOK_URL?[new WebhookLeadAction(process.env.SSGAI_LEAD_WEBHOOK_URL).save(record)]:[])];
  const results=await Promise.allSettled(optional);
  results.forEach((r)=>{if(r.status==="rejected") console.error(JSON.stringify({event:"lead_sync_failed",leadId:record.id,message:r.reason instanceof Error?r.reason.message:"unknown"}))});
}

