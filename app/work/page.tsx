import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ProjectExamples from '@/components/ProjectExamples';

export const metadata = {
  title: 'Our Work',
  description: 'Explore founder-owned website projects from Shipley Solutions Group: Shipley’s Detailing and Jaden Shipley’s personal website.',
  alternates: { canonical: '/work' },
};

export default function Work() {
  return <main id="main-content"><section className="page-hero"><div className="container"><div className="eyebrow">Our work</div><h1 className="display about-display">Different businesses.<br/><span className="blue">A clear story for each.</span></h1><p className="lede">Explore websites created for Jaden’s own business and personal brand. These are founder-owned projects, presented as examples of the work.</p></div></section><section className="section-tight"><div className="container"><ProjectExamples /></div></section><section className="section"><div className="container cta"><div><h2>What should your website say?</h2><p className="lede cta-copy">Let’s turn your business, services and strengths into a focused website.</p></div><Link className="btn btn-primary" href="/contact">Discuss Your Website <ArrowRight size={18}/></Link></div></section></main>;
}
