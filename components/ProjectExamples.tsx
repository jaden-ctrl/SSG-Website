import { ArrowUpRight } from 'lucide-react';
import ProjectPreview from '@/components/ProjectPreview';

const projects = [
  {
    id: 'detailing' as const, name: 'Shipley’s Detailing', category: 'Service business', domain: 'shipleysdetailing.com',
    goal: 'Make the services, quality of work and next step easy to understand.',
    decisions: ['Use original vehicle photography to put the work first.', 'Organize service information so customers can compare their options.', 'Explain the mobile transition and route visitors toward inquiries.'],
    note: 'Founder-owned business. Online booking is paused during the mobile transition.',
  },
  {
    id: 'personal' as const, name: 'Jaden Shipley', category: 'Personal brand', domain: 'jadenshipley.com',
    goal: 'Give visitors a clear introduction to the person behind the businesses.',
    decisions: ['Lead with a portrait and a personal introduction.', 'Connect the founder’s story, businesses and long-term vision.', 'Provide direct paths to learn more and get in touch.'],
    note: 'SSG founder’s personal website.',
  },
];

export default function ProjectExamples({ compact = false }: { compact?: boolean }) {
  return <div className="grid-2 project-grid">{projects.map(project=><article className="project-card visual-project" key={project.id}>
    <a href={`https://${project.domain}/`} target="_blank" rel="noopener noreferrer" className="project-preview-link" aria-label={`Explore ${project.name} website (opens in a new tab)`}><ProjectPreview project={project.id}/></a>
    <div className="project-copy"><span className="eyebrow">{project.category}</span><h3>{project.name}</h3><p className="project-goal"><b>The goal</b>{project.goal}</p>{!compact && <><h4>Design decisions</h4><ul className="decision-list">{project.decisions.map(decision=><li key={decision}>{decision}</li>)}</ul></>}<p className="project-disclosure">{project.note} Visual above is a design excerpt using original project imagery and content.</p><a className="text-link" href={`https://${project.domain}/`} target="_blank" rel="noopener noreferrer">Explore the full website <ArrowUpRight size={17}/><span className="sr-only"> (opens in a new tab)</span></a></div>
  </article>)}</div>;
}
