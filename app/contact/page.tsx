import Link from 'next/link';
import { ArrowRight, ClipboardList, MessageSquareText, PencilRuler } from 'lucide-react';
import LeadForm from '@/components/LeadForm';

export const metadata = {
  title: 'Request a Website Quote',
  description: 'Start a website project with Shipley Solutions Group. Tell Jaden about your business, goals and timeline to discuss the right scope.',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return <main id="main-content"><section className="page-hero contact-page"><div className="container contact-grid">
    <div className="contact-intro"><div className="eyebrow">Request a website quote</div><h1 className="h2 contact-title">Tell us your goals.<br/><span className="blue">Get a clear proposal.</span></h1><p className="lede">Tell Jaden what the website needs to achieve. After discussing your requirements, you’ll receive a proposed scope, project pricing and timeline to review before committing to the work.</p>
      <div className="conversation-steps"><div><MessageSquareText size={20}/><span><strong>Share the essentials</strong><small>Your organization, project type and the result you want.</small></span></div><div><PencilRuler size={20}/><span><strong>Clarify the requirements</strong><small>Audiences, pages, features, integrations and team requirements.</small></span></div><div><ClipboardList size={20}/><span><strong>Review your quote</strong><small>See deliverables, pricing, milestones and any ongoing costs.</small></span></div></div>
      <div className="contact-callout"><span className="eyebrow">Want feedback first?</span><p>Get a personal review of your current website before deciding on a project.</p><Link href="/audit">Request a Free Website Review <ArrowRight size={16}/></Link></div>
    </div>
    <div className="contact-form-shell"><div className="contact-form-head"><span className="pill">WEBSITE QUOTE REQUEST</span><h2>What should your website do?</h2><p className="muted">Share what you know. We’ll help work through the details.</p></div><LeadForm /></div>
  </div></section></main>;
}
