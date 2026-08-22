import { ArrowRight, Clock3, Layers3, MessageSquareText } from 'lucide-react';
import LeadForm from '@/components/LeadForm';

export const metadata = { title: 'Start a Conversation' };

export default function Contact() {
  return (
    <main>
      <section className="page-hero contact-page">
        <div className="container contact-grid">
          <div className="contact-intro">
            <div className="eyebrow">Start a Conversation</div>
            <h1 className="h2" style={{ fontSize: 'clamp(2.8rem,6vw,5rem)' }}>
              Let’s talk about what you want to build next.
            </h1>
            <p className="lede">
              Have a project, system or growth initiative in mind? Give us the goal, scope and timing. We’ll use that
              context to determine the smartest next conversation.
            </p>

            <div className="conversation-steps">
              <div><MessageSquareText size={20} /><span><strong>01 — Tell us the objective</strong><small>What needs to change, improve or get built?</small></span></div>
              <div><Layers3 size={20} /><span><strong>02 — Define the scope</strong><small>Website, CRM, automation, AI, lead generation or a broader system.</small></span></div>
              <div><Clock3 size={20} /><span><strong>03 — Align on timing</strong><small>If there’s a fit, we move into discovery and next steps.</small></span></div>
            </div>

            <div className="contact-callout">
              <span className="eyebrow">Not sure what you need?</span>
              <p>If you want us to diagnose the problem first, use the Free Business Audit instead.</p>
              <a href="/audit">Request a Free Audit <ArrowRight size={16} /></a>
            </div>
          </div>

          <div className="contact-form-shell">
            <div className="contact-form-head">
              <span className="pill">PROJECT INQUIRY</span>
              <h2>Start with the outcome.</h2>
              <p className="muted">We’ll use your answers to route the conversation appropriately.</p>
            </div>
            <LeadForm source="project-inquiry" variant="contact" />
          </div>
        </div>
      </section>
    </main>
  );
}
