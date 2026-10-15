import Link from 'next/link';
import { ArrowRight, Check, LayoutTemplate, MessageSquare, Smartphone, Workflow } from 'lucide-react';
import ProjectExamples from '@/components/ProjectExamples';
import WebsiteProcess from '@/components/WebsiteProcess';

export const metadata = {
  title: 'Custom Business Websites',
  description: 'Custom websites for businesses and organizations. Work directly with Jaden Shipley on a clear message, thoughtful design and a simple path to customer inquiries.',
  alternates: { canonical: '/' },
};

export default function Home() {
  return <main id="main-content">
    <section className="hero website-hero"><div className="container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow">Strategic web design &amp; development</div>
        <h1 className="display website-display">Your business deserves<br/><span className="blue">a better website.</span></h1>
        <p className="lede">Present your organization with confidence, communicate what makes it valuable, and guide visitors toward the right next step. SSG builds custom websites around your business goals.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/contact">Discuss Your Website <ArrowRight size={18}/></Link><Link className="btn btn-secondary" href="/work">Explore Our Work</Link></div>
        <p className="hero-note">New websites &amp; redesigns · Direct collaboration with the founder</p>
      </div>
      <div className="website-illustration" aria-label="Illustration of a clear service business website">
        <div className="browser-bar"><span className="browser-dots" aria-hidden="true"><i/><i/><i/></span><span>Your next website</span><LayoutTemplate size={16}/></div>
        <div className="browser-content">
          <div className="sample-nav"><strong>YOUR BUSINESS</strong><span>Services &nbsp; About &nbsp; Contact</span></div>
          <div className="sample-eyebrow">A clear first impression</div>
          <div className="sample-headline">Make what you do<br/><em>impossible to miss.</em></div>
          <p>A focused message. Work worth showing.<br/>One obvious next step.</p>
          <span className="sample-button" aria-hidden="true">Let’s talk <ArrowRight size={15}/></span>
          <div className="sample-features"><span>01 <b>Your services</b></span><span>02 <b>Your work</b></span><span>03 <b>Get in touch</b></span></div>
        </div>
        <div className="illustration-caption"><Smartphone size={16}/> Designed for the way customers browse <span>Design illustration</span></div>
      </div>
    </div></section>
    <div className="website-strip"><div className="container"><span><Check size={17}/> A clear message</span><span><Check size={17}/> A thoughtful mobile experience</span><span><Check size={17}/> A simple path to inquiries</span></div></div>
    <section className="section"><div className="container">
      <div className="section-head"><div><div className="eyebrow">Start with the essentials</div><h2 className="h2">Make it easier<br/>to choose your business.</h2></div><p className="lede section-copy">Your website should answer the questions a customer has before they reach out.</p></div>
      <div className="grid-3">{[
        { Icon: LayoutTemplate, title: 'Explain your offer', copy: 'Put your services, service area and strengths into words people can understand quickly.' },
        { Icon: Smartphone, title: 'Build confidence', copy: 'Bring your brand, real work and business details together in a layout that works on phones and desktops.' },
        { Icon: MessageSquare, title: 'Make contact simple', copy: 'Give visitors a clear way to call, request a quote or ask about a project, without making them hunt for it.' },
      ].map(({ Icon, title, copy }) => <article className="card service-card" key={title}><div className="card-icon"><Icon size={21}/></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
      <Link className="text-link section-link" href="/services">See what goes into your website <ArrowRight size={17}/></Link>
    </div></section>
    <section className="section work-section"><div className="container">
      <div className="section-head"><div><div className="eyebrow">Selected work</div><h2 className="h2">See the thinking<br/>in practice.</h2></div><p className="lede section-copy">A service business and a personal brand. These founder-owned projects show two different ways to tell a clear story online.</p></div>
      <ProjectExamples compact /><Link className="text-link section-link" href="/work">Explore the projects <ArrowRight size={17}/></Link>
    </div></section>
    <section className="section" id="process"><div className="container">
      <div className="section-head"><div><div className="eyebrow">How it works</div><h2 className="h2">From the first conversation<br/>to your new website.</h2></div><p className="lede section-copy">A defined scope, room for your feedback, and a clear next step at each stage.</p></div><WebsiteProcess />
    </div></section>
    <section className="section-tight"><div className="container split review-feature">
      <div><div className="eyebrow">Already have a website?</div><h2 className="h2">Get a fresh pair of eyes on it.</h2><p className="lede">Jaden will personally review your website’s message, mobile experience and inquiry path, then email you practical suggestions.</p><Link href="/audit" className="btn btn-secondary">Request a Free Website Review <ArrowRight size={18}/></Link></div>
      <div className="review-checklist"><span className="pill">PERSONALLY REVIEWED</span><h3>What we’ll look at</h3>{['Is it clear what you do and who you help?','Can customers find what they need on mobile?','Is the next step easy to spot and complete?'].map(item=><p key={item}><Check size={18}/>{item}</p>)}<small>No cost. No obligation to start a project.</small></div>
    </div></section>
    <section className="section"><div className="container support-row"><div className="card-icon"><Workflow size={23}/></div><div><div className="eyebrow">Build on the foundation</div><h2>Need help after the inquiry?</h2><p>CRM setup, follow-up workflows, automation and local visibility can be scoped alongside your website or as a later project.</p></div><Link href="/services#supporting-services" className="text-link">Explore supporting services <ArrowRight size={17}/></Link></div></section>
    <section className="section-tight"><div className="container cta"><div><h2>Let’s build a website<br/>that fits your business.</h2><p className="lede cta-copy">Tell us what you do and what your website needs to achieve.</p></div><Link className="btn btn-primary" href="/contact">Discuss Your Website <ArrowRight size={18}/></Link></div></section>
  </main>;
}
