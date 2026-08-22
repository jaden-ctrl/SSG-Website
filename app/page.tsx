import Link from 'next/link';
import { ArrowRight, Bot, ChartNoAxesCombined, Code2, DatabaseZap, Search, Workflow } from 'lucide-react';

const services = [
  [Code2, 'Websites & Digital Presence', 'High-converting websites engineered around clarity, speed, trust and measurable action.'],
  [Workflow, 'Workflow Automation', 'Remove repetitive work and connect the systems your business already depends on.'],
  [Bot, 'AI Implementation', 'Deploy practical AI for research, intake, operations, support and decision workflows.'],
  [DatabaseZap, 'CRM & Sales Systems', 'Build pipelines, lead routing and follow-up systems that keep revenue opportunities moving.'],
  [Search, 'Local Lead Generation', 'Strengthen search visibility, conversion paths and campaigns designed to produce qualified demand.'],
  [ChartNoAxesCombined, 'Growth Advisory', 'Find the constraint, design the system and create an execution plan tied to business outcomes.'],
];

export default function Home() {
  return <main>
    <section className="hero"><div className="container hero-grid">
      <div>
        <div className="eyebrow">Systems for serious growth</div>
        <h1 className="display">Build smarter.<br/><span className="blue">Convert more.</span><br/>Scale faster.</h1>
        <p className="lede">Shipley Solutions Group helps businesses increase revenue through digital infrastructure, automation, AI, lead generation and strategic growth systems.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/audit">Get a Free Business Audit <ArrowRight size={18}/></Link><Link className="btn btn-secondary" href="/services">Explore Solutions</Link></div>
        <div className="hero-proof"><span><b>Strategy + execution</b> in one partner</span><span><b>Built for ROI</b>, not vanity metrics</span></div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="orb" />
        <div className="hero-card main"><span className="pill">SSG GROWTH SYSTEM</span><div style={{marginTop:20,fontSize:'1.15rem',fontWeight:850}}>From scattered tools to one operating engine.</div><div className="flow">{['Capture demand','Qualify the opportunity','Route into CRM','Automate follow-up','Measure & optimize'].map((x,i)=><div className="flow-step" key={x}><span><i className="step-dot"/> {x}</span><small>0{i+1}</small></div>)}</div></div>
        <div className="hero-card mini"><div className="muted" style={{fontSize:'.78rem',fontWeight:800}}>SYSTEM LEVERAGE</div><div className="metric">24/7</div><div className="muted" style={{fontSize:'.86rem'}}>Your systems keep working when you are not.</div></div>
      </div>
    </div></section>

    <section className="section" id="services"><div className="container">
      <div className="section-head"><div><div className="eyebrow">Capabilities</div><h2 className="h2">We build the infrastructure behind growth.</h2></div><p className="lede" style={{maxWidth:480}}>The goal is not to add more software. The goal is to make your business easier to find, easier to buy from and easier to operate.</p></div>
      <div className="grid-3">{services.map(([Icon,title,desc]:any)=><div className="card" key={title}><div className="card-icon"><Icon size={21}/></div><h3>{title}</h3><p>{desc}</p></div>)}</div>
    </div></section>

    <section className="section-tight"><div className="container"><div className="eyebrow">Our operating framework</div><h2 className="h2">One system. Seven stages.</h2><div className="process">{['Discover','Audit','Build','Convert','Optimize','Automate','Scale'].map(x=><div className="process-item" key={x}>{x}</div>)}</div></div></section>

    <section className="section"><div className="container split"><div><div className="eyebrow">Designed around bottlenecks</div><h2 className="h2">Stop buying isolated tactics.</h2><p className="lede">A better website does not fix a broken follow-up process. More leads do not help if your CRM loses them. Automation does not matter if the workflow itself is weak. We diagnose the constraint first, then build around it.</p><div className="taglist"><span className="tag">Conversion</span><span className="tag">Speed</span><span className="tag">Lead Flow</span><span className="tag">Follow-up</span><span className="tag">Operations</span><span className="tag">Measurement</span></div></div><div className="card"><div className="kicker-number">01</div><h3 style={{fontSize:'1.55rem'}}>Start with the audit.</h3><p>We map your current website, offer, lead flow, CRM, follow-up and automation opportunities. You leave with a prioritized view of what is actually worth fixing.</p><Link href="/audit" className="btn btn-primary" style={{marginTop:22}}>Request Free Audit <ArrowRight size={18}/></Link></div></div></section>

    <section className="section"><div className="container cta"><div><h2>Ready to build the next version of your business?</h2><p className="lede" style={{margin:0}}>Tell us where growth is getting stuck. We’ll identify the highest-leverage next move.</p></div><Link className="btn btn-primary" href="/contact">Start a Conversation <ArrowRight size={18}/></Link></div></section>
  </main>;
}
