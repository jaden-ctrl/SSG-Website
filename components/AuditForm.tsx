'use client';

import { FormEvent, useState } from 'react';

export default function AuditForm() {
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    setStatus('Sending your business data to Atlas…');

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const params = new URLSearchParams(window.location.search);

    const payload = {
      ...data,
      source: 'free-business-audit',
      form_variant: 'audit',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      landing_page: window.location.href,
    };

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(result?.error || 'Atlas is not available yet. Please try again later.');
        return;
      }

      form.reset();
      setStatus('Your audit has been generated.');
    } catch {
      setStatus('Something went wrong while connecting to Atlas. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <label>
          First name
          <input name="first_name" required autoComplete="given-name" />
        </label>
        <label>
          Last name
          <input name="last_name" required autoComplete="family-name" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Email
          <input name="email" required type="email" autoComplete="email" />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>

      <label>
        Company
        <input name="company" required />
      </label>

      <label>
        Website or primary online presence
        <input name="website" placeholder="https://" required />
      </label>

      <div className="form-row">
        <label>
          Primary growth concern
          <select name="growth_concern" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option>Website is not converting</option>
            <option>Not enough qualified leads</option>
            <option>Follow-up is inconsistent</option>
            <option>CRM / pipeline is disorganized</option>
            <option>Too much manual work</option>
            <option>Need stronger local visibility</option>
            <option>Not sure — need diagnosis</option>
          </select>
        </label>
        <label>
          Approximate monthly lead volume
          <select name="monthly_leads" defaultValue="">
            <option value="" disabled>Select range</option>
            <option>0–10</option>
            <option>11–30</option>
            <option>31–100</option>
            <option>100+</option>
            <option>Not sure</option>
          </select>
        </label>
      </div>

      <label>
        Where do leads currently go after they contact you?
        <input name="lead_flow" placeholder="Example: email inbox, spreadsheet, HubSpot, phone only" />
      </label>

      <label>
        What feels like the biggest leak right now?
        <textarea name="message" required />
      </label>

      <button className="btn btn-primary" type="submit" disabled={sending}>
        {sending ? 'Analyzing…' : 'Request My Free Audit'}
      </button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
