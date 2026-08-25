import Link from 'next/link';
import { ArrowRight, CheckCircle2, Compass, Hammer, LineChart, Network } from 'lucide-react';
import { Reveal } from '@/components/Motion';

export const metadata = { title: 'About' };

const principles = [
  [Compass, 'Clarity before complexity', 'We locate the real business constraint before recommending a platform, campaign or build.'],
  [Hammer, 'Execution with accountability', 'Strategy becomes useful when it is translated into working systems, clear ownership and measurable actions.'],
  [Network, 'The whole system matters', 'Website, CRM, follow-up, automation and analytics must work together—not as disconnected projects.'],
  [LineChart, 'Optimization is continuous', 'We use evidence from the system to improve performance and scale the parts that create value.'],
];

export default function About(){return <main>
  <section className="page-hero about-hero"><div className="container"><div className="eyebrow">About Shipley Solutions Group</div><h1 className="display about-display">We turn business friction<br/><span className="blue">into operating leverage.</span></h1><p className="lede">Shipley Solutions Group is a business growth and technology partner. We help ambitious organizations generate demand, convert more opportunities and operate more efficiently by connecting strategy with the systems that execute it.</p></div></section>
  <section className="section-tight"><div className="container split about-intro">
    <Reveal><div><div className="eyebrow">Who we are</div><h2 className="h2">Strategy is useless without execution.</h2><p className="lede">That belief shapes how SSG works. We do not hand over recommendations and disappear. We connect the strategy to practical infrastructure—the website, CRM, automations, lead capture, follow-up, analytics and operating workflows that make growth repeatable.</p></div></Reveal>
    <Reveal delay={100}><div className="card definition-card"><span className="pill">THE SSG DIFFERENCE</span><h3>Business thinking. Technical execution. One accountable partner.</h3><p>Instead of coordinating a strategist, designer, developer, automation specialist and CRM consultant, clients work with one team that understands how every part affects the outcome.</p></div></Reveal>
  </div></section>
  <section className="section"><div className="container"><Reveal><div className="section-head"><div><div className="eyebrow">Our approach</div><h2 className="h2">Built around the outcome, not the tool.</h2></div><p className="lede section-copy">Every engagement starts with the business reality: where growth is stuck, what success looks like and which change creates the most leverage.</p></div></Reveal><div className="grid-2">{principles.map(([Icon, title, desc]: any, index)=><Reveal key={title} delay={index * 80}><div className="card approach-card"><div className="card-icon"><Icon size={21}/></div><div><h3>{title}</h3><p>{desc}</p></div></div></Reveal>)}</div></div></section>
  <section className="section outcomes-panel"><div className="container split"><Reveal><div><div className="eyebrow">What this changes</div><h2 className="h2">Systems that make the business easier to grow.</h2></div></Reveal><Reveal delay={100}><div className="outcome-list large">{['A clearer, more credible path from visitor to buyer','Qualified leads captured and routed without delay','Follow-up that happens consistently instead of manually','Teams spending less time moving information between tools','Decision-makers seeing where growth is working—and where it is not'].map(x=><span key={x}><CheckCircle2 size={20}/>{x}</span>)}</div></Reveal></div></section>
  <section className="section"><div className="container cta"><div><h2>Find the highest-leverage opportunity.</h2><p className="lede cta-copy">Start with a structured diagnostic of your current growth system.</p></div><Link href="/audit" className="btn btn-primary">Get the Free Audit <ArrowRight size={18}/></Link></div></section>
</main>}
