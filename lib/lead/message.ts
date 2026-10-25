import { timelineLabel } from "../hubspot/lead-automation";
import type { LeadInput } from "./types";

export function consentLine(lead: LeadInput, atIso: string, version: string): string {
  return `Consent: yes, ${atIso}, text v${version}, form ${lead.form_variant}`;
}

export function hubspotMessage(lead: LeadInput, atIso: string, version: string): string {
  const lines = [
    `SSG website submission: ${lead.source || lead.form_variant}`,
    `Submitted: ${atIso}`,
  ];
  if (lead.form_variant === "website_review") {
    lines.push(
      "Request type: Free Website Review — manual follow-up required",
      `Website to review: ${lead.website}`,
      `What they want to improve: ${lead.message}`,
      "Next action: Jaden personally reviews the website and follows up by email.",
    );
  } else {
    lines.push(
      `Project type: ${lead.project_type || "Not provided"}`,
      `Target timeline: ${timelineLabel(lead.timeline)}`,
      `Estimated investment: ${lead.budget || "Not provided"}`,
      `Desired outcome: ${lead.message || "Not provided"}`,
    );
  }
  lines.push(consentLine(lead, atIso, version));
  const attribution = [
    ["Landing page", lead.landing_page],
    ["UTM source", lead.utm_source],
    ["UTM medium", lead.utm_medium],
    ["UTM campaign", lead.utm_campaign],
  ].filter(([, value]) => value);
  if (attribution.length) {
    lines.push("", "Attribution:");
    for (const [label, value] of attribution) lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
