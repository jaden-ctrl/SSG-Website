import Link from 'next/link';
import { ArrowRight, Bot, ChartNoAxesCombined, Check, Code2, DatabaseZap, Search, Workflow } from 'lucide-react';
import { CountUp, Reveal } from '@/components/Motion';
import AtlasBrain from '@/components/AtlasBrain';
import AtlasFramework from '@/components/AtlasFramework';
import AtlasReveal from '@/components/AtlasReveal';

const services = [
  [Code2, 'Websites & Digital Presence', 'High-converting websites engineered around clarity, speed, trust and measurable action.'],
  [Workflow, 'Workflow Automation', 'Remove repetitive work and connect the systems your business already depends on.'],
  [Bot, 'AI Implementation', 'Deploy practical AI for research, intake, operations, support and decision workflows.'],
  [DatabaseZap, 'CRM & Sales Systems', 'Build pipelines, lead routing and follow-up systems that keep revenue opportunities moving.'],
  [Search, 'Local Lead Generation', 'Strengthen search visibility, conversion paths and campaigns designed to produce qualified demand.'],
  [ChartNoAxesCombined, 'Growth Advisory', 'Find the constraint, design the system and create an execution plan tied to business outcomes.'],
];

const journey = [
  ['Free Audit', 'Give Atlas the context to examine your current growth system.'],
  ['Diagnosis', 'Identify the constraint, the leaks and the highest-leverage opportunities.'],
  ['Strategy', 'Turn the findings into a focused roadmap with clear priorities.'],
  ['Implementation', 'Build the website, CRM, automation, AI and workflows that make it real.'],
  ['Optimization & Growth', 'Measure performance, improve the system and scale what works.'],
];

export default function Home() {
  return <main>
    <section className="hero cinematic-hero"><div className="container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow">Systems for serious growth · V4</div>
        <h1 className="display">Build smarter.<br/><span className="blue">Convert more.</span><br/>Scale faster.</h1>
        <p className="lede">Shipley Solutions Group helps businesses increase revenue through digital infrastructure, automation, AI, lead generation and strategic growth systems.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/audit">Get a Free Business Audit <ArrowRight size={18}/></Link><Link className="btn btn-secondary" href="/services">Explore Solutions</Link></div>
        <div className="hero-proof"><span><b>Strategy + execution</b> in one partner</span><span><b>Built for ROI</b>, not vanity metrics</span></div>
      </div>
      <AtlasBrain />
    </div></section>

    <section className="proof-strip"><div className="container proof-grid">
      <div><strong><CountUp value={7}/></strong><span>Connected growth stages</span></div>
      <div><strong><CountUp value={1}/></strong><span>Strategy-to-execution partner</span></div>
      <div><strong><CountUp value={24} suffix="/7"/></strong><span>Automated systems working behind the scenes</span></div>
    </div></section>

    <section className="section" id="services"><div className="container">
      <Reveal><div className="section-head"><div><div className="eyebrow">Capabilities</div><h2 className="h2">We build the infrastructure behind growth.</h2></div><p className="lede section-copy">The goal is not to add more software. The goal is to make your business easier to find, easier to buy from and easier to operate.</p></div></Reveal>
      <div className="grid-3">{services.map(([Icon,title,desc]: any, index)=><Reveal key={title} delay={index * 70}><div className="card service-card"><div className="card-icon"><Icon size={21}/></div><h3>{title}</h3><p>{desc}</p></div></Reveal>)}</div>
    </div></section>

    <section className="section framework-section"><div className="container">
      <Reveal><div className="eyebrow">Our operating framework</div><h2 className="h2">One system. Seven connected stages.</h2><p className="lede">Follow the energy through the system. Each stage activates in sequence because sustainable growth is created by the handoffs between them—not one isolated tactic.</p></Reveal>
      <AtlasFramework />
    </div></section>

    <section className="section atlas-reveal-section"><div className="container">
      <AtlasReveal />
    </div></section>

    <section className="section journey-section"><div className="container">
      <Reveal><div className="section-head"><div><div className="eyebrow">From insight to impact</div><h2 className="h2">A clear path from audit to growth.</h2></div><p className="lede section-copy">You always know what we are solving, what comes next and how the work connects to a business outcome.</p></div></Reveal>
      <div className="journey" role="list">{journey.map(([title, desc], index) => <Reveal key={title} delay={index * 80}><div className="journey-step" role="listitem"><div className="journey-number">{String(index + 1).padStart(2, '0')}</div><div><h3>{title}</h3><p>{desc}</p></div>{index < journey.length - 1 && <ArrowRight className="journey-arrow" size={18}/>}</div></Reveal>)}</div>
    </div></section>

    <section className="section"><div className="container split outcome-section"><Reveal><div><div className="eyebrow">Why SSG</div><h2 className="h2">One partner from diagnosis through execution.</h2><p className="lede">SSG sits at the intersection of business strategy and practical implementation. We find the constraint, design the right operating system and build the parts that make it perform.</p><div className="outcome-list">{['More qualified opportunities entering the pipeline','Faster, more consistent lead follow-up','Less manual work and fewer operational gaps','Clearer data for better growth decisions'].map(x=><span key={x}><Check size={18}/>{x}</span>)}</div><Link href="/about" className="text-link">See how we work <ArrowRight size={17}/></Link></div></Reveal><Reveal delay={120}><div className="card principle-card"><div className="kicker-number">01</div><h3>Diagnose before prescribing.</h3><p>A better website does not fix a broken follow-up process. More leads do not help if your CRM loses them. We identify the highest-leverage constraint first, then build around it.</p><Link href="/audit" className="btn btn-primary">Request Free Audit <ArrowRight size={18}/></Link></div></Reveal></div></section>

    <section className="section"><div className="container cta"><div><h2>Ready to build the next version of your business?</h2><p className="lede cta-copy">Tell us where growth is getting stuck. We’ll identify the highest-leverage next move.</p></div><Link className="btn btn-primary" href="/contact">Start a Conversation <ArrowRight size={18}/></Link></div></section>
  </main>;
}
