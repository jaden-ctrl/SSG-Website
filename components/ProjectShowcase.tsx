'use client';

import { useState } from 'react';
import { ArrowUpRight, Monitor, Smartphone } from 'lucide-react';
import ProjectPreview from '@/components/ProjectPreview';

export default function ProjectShowcase() {
  const [project, setProject] = useState<'detailing' | 'personal'>('detailing');
  const [mobile, setMobile] = useState(false);
  return <div className="project-showcase">
    <div className="showcase-controls"><div className="showcase-projects" role="group" aria-label="Choose a project"><button type="button" aria-pressed={project === 'detailing'} onClick={()=>setProject('detailing')}>Detailing</button><button type="button" aria-pressed={project === 'personal'} onClick={()=>setProject('personal')}>Personal brand</button></div><div className="showcase-devices" role="group" aria-label="Preview layout"><button type="button" aria-label="Desktop layout" aria-pressed={!mobile} onClick={()=>setMobile(false)}><Monitor size={17}/></button><button type="button" aria-label="Mobile layout" aria-pressed={mobile} onClick={()=>setMobile(true)}><Smartphone size={17}/></button></div></div>
    <div className={`showcase-stage ${mobile ? 'is-mobile' : ''}`}><ProjectPreview project={project} mobile={mobile} eager /></div>
    <div className="showcase-caption"><span>Design excerpt · Founder-owned project</span><a href={project === 'detailing' ? 'https://shipleysdetailing.com/' : 'https://jadenshipley.com/'} target="_blank" rel="noopener noreferrer">View full site <ArrowUpRight size={14}/><span className="sr-only"> (opens in a new tab)</span></a></div>
  </div>;
}
