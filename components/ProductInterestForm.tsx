'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const FORM_NAME = 'ssg-products-interest';

export default function ProductInterestForm({ products }: { products: readonly string[] }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = new URLSearchParams({
      'form-name': FORM_NAME,
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      product: String(data.get('product') ?? ''),
      message: String(data.get('message') ?? ''),
      consent: String(data.get('consent') ?? ''),
      'bot-field': String(data.get('bot-field') ?? ''),
    });
    try {
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!response.ok) throw new Error('Unable to submit');
      form.reset();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="products-interest-form products-interest-success" role="status">
        <CheckCircle2 size={38} aria-hidden="true" />
        <h3>You're on the interest list.</h3>
        <p>Thanks for sharing what you're interested in. We will email you about relevant launches.</p>
        <button type="button" className="products-interest-reset" onClick={() => setStatus('idle')}>Submit another response</button>
      </div>
    );
  }

  return (
    <form name={FORM_NAME} className="products-interest-form" method="POST" onSubmit={handleSubmit}>
      <input type="hidden" name="form-name" value={FORM_NAME} />
      <div className="products-bot-field" aria-hidden="true"><label>Leave blank<input type="text" name="bot-field" tabIndex={-1} autoComplete="off" /></label></div>
      <h3>Get product launch updates</h3>
      <p className="products-interest-form-subtitle">Tell us which resource interests you most.</p>
      <div className="products-form-row">
        <label>Full name<input type="text" name="name" autoComplete="name" maxLength={100} placeholder="Your name" required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" maxLength={254} placeholder="you@business.com" required /></label>
      </div>
      <label>Interested in
        <select name="product" defaultValue="" required>
          <option value="" disabled>Choose a product</option>
          <option value="General product updates">General product updates</option>
          {products.map(product => <option key={product} value={product}>{product}</option>)}
        </select>
      </label>
      <label>What would help your business? <span className="products-optional">(optional)</span>
        <textarea name="message" rows={3} maxLength={1000} placeholder="What are you trying to accomplish?" />
      </label>
      <label className="products-form-consent">
        <input type="checkbox" name="consent" value="yes" required />
        <span>I agree to receive SSG emails about digital product availability and updates.</span>
      </label>
      {status === 'error' && <p className="products-form-error" role="alert">We could not send your request. Please try again.</p>}
      <button type="submit" className="btn btn-primary products-submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Submitting…' : 'Join the Launch List'}
        {status !== 'submitting' && <ArrowRight size={18} />}
      </button>
      <p className="products-form-privacy">We use your details for SSG product-launch communication. This is not a purchase or paid subscription.</p>
    </form>
  );
}
