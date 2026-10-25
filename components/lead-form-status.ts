/** Visitor-facing copy. A failure keeps the form; it never shows the thank-you. */
export const LEAD_FORM_ERROR = "Your request could not be confirmed. Your answers are still here—please try again.";
export const LEAD_FORM_WEBSITE_ERROR = "Please enter a valid website address, such as yourbusiness.com.";

export type LeadFormOutcome = {
  succeeded: boolean;
  failed: boolean;
  status: string;
};

/**
 * Pure result of a /api/lead response.
 * Honeypot and fast-fill are the only 2xx {ok:true} responses with no lead record.
 * Every other failure, including a 200 with ok not strictly true, is an error.
 */
export function leadFormResult(input: {
  networkError?: boolean;
  parseError?: boolean;
  httpOk?: boolean;
  parsed?: { ok?: unknown } | null;
  websiteError?: boolean;
}): LeadFormOutcome {
  if (input.websiteError) {
    return { succeeded: false, failed: true, status: LEAD_FORM_WEBSITE_ERROR };
  }
  const accepted = !input.networkError && !input.parseError && input.httpOk === true && input.parsed?.ok === true;
  if (!accepted) return { succeeded: false, failed: true, status: LEAD_FORM_ERROR };
  return { succeeded: true, failed: false, status: "received" };
}
