import { Bot, ChartNoAxesCombined, Code2, DatabaseZap, Search, Workflow } from 'lucide-react';
import Link from 'next/link';

const items = [
  [Code2,'Websites & Digital Presence','Strategy, UX, conversion architecture, responsive development, analytics and SEO foundations.','Your website should create confidence quickly and move the right visitor toward action.'],
  [DatabaseZap,'CRM & Revenue Operations','Pipeline design, intake, segmentation, lead routing, follow-up logic and reporting.','Turn inquiries into a managed revenue process instead of a messy inbox.'],
  [Workflow,'Workflow Automation','Integrations, notifications, handoffs, data movement and repetitive process automation.','Reduce manual touches while increasing consistency and speed.'],
  [Bot,'AI Implementation','Research agents, business assistants, intake analysis, content workflows and internal copilots.','Use AI where it can create leverage — not because it is trendy.'],
  [Search,'Local Lead Generation','Local search foundations, offer structure, landing pages, attribution and campaign support.','Create more qualified demand and know where it came from.'],
  [ChartNoAxesCombined,'Business Growth Advisory','Offer review, funnel diagnosis, process mapping, KPI selection and execution planning.','Find the constraint and focus resources where they can actually move the business.']
];
export const metadata = { title: 'Services' };
export default function Services(){return <main><section className="page-hero"><div className="container"><div className="eyebrow">Services</div><h1 className="display" style={{fontSize:'clamp(2.8rem,7vw,5.2rem)'}}>Technology and growth systems<br/><span className="blue">built around outcomes.</span></h1><p className="lede">SSG combines strategy, implementation and automation so businesses can stop duct-taping tools together and start operating as a system.</p></div></section><section className="section-tight"><div className="container grid-2">{items.map(([Icon,title,scope,outcome]:any)=><article className="card" key={title}><div className="card-icon"><Icon size={22}/></div><h3>{title}</h3><p>{scope}</p><p style={{marginTop:16,color:'#e3e7ed'}}><b>Business outcome:</b> {outcome}</p></article>)}</div></section><section className="section"><div className="container cta"><div><h2>Not sure which service you need?</h2><p className="lede" style={{margin:0}}>Good. Start with the problem, not the product.</p></div><Link href="/audit" className="btn btn-primary">Request a Free Audit</Link></div></section></main>}
