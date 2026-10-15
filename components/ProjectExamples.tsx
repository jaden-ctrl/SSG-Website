import { ArrowUpRight } from 'lucide-react';

const projects = [
  {
    name: 'Shipley’s Detailing', category: 'Service business', domain: 'shipleysdetailing.com',
    title: 'A clear home for hands-on automotive care.',
    description: 'Service information, real detailing work and straightforward inquiry paths, with messaging that explains the transition to mobile detailing.',
    details: ['Service presentation', 'Work photography', 'Customer inquiry paths'],
    note: 'Founder-owned business. Online booking is paused during the mobile transition.',
    className: 'detailing-project', monogram: 'SD',
  },
  {
    name: 'Jaden Shipley', category: 'Personal brand', domain: 'jadenshipley.com',
    title: 'The person and purpose behind the businesses.',
    description: 'A personal website that brings Jaden’s story, business ownership and long-term vision together in one place.',
    details: ['Founder story', 'Business connections', 'Personal identity'],
    note: 'SSG founder’s personal website.',
    className: 'personal-project', monogram: 'JS',
  },
];

export default function ProjectExamples({ compact = false }: { compact?: boolean }) {
  return <div className="grid-2 project-grid">{projects.map(project=><article className={`project-card ${project.className}`} key={project.domain}>
    <div className="project-identity"><span className="project-monogram" aria-hidden="true">{project.monogram}</span><div><span className="eyebrow">{project.category}</span><h3>{project.name}</h3><span className="project-domain">{project.domain}</span></div></div>
    <div className="project-copy"><h4>{project.title}</h4><p>{project.description}</p>{!compact && <ul className="project-details">{project.details.map(detail=><li key={detail}>{detail}</li>)}</ul>}<p className="project-disclosure">{project.note}</p><a className="text-link" href={`https://${project.domain}/`} target="_blank" rel="noopener noreferrer">Visit website <ArrowUpRight size={17}/><span className="sr-only"> (opens in a new tab)</span></a></div>
  </article>)}</div>;
}
