import { MessagesSquare, PenTool, Code2, Rocket } from 'lucide-react';

const stages = [
  { Icon: MessagesSquare, title: 'Scope & quote', copy: 'Talk through your business, pages, features and priorities. Agree on the scope and quote before work starts.' },
  { Icon: PenTool, title: 'Design', copy: 'Shape the message and visual direction. Review the layout and provide consolidated feedback at the agreed stages.' },
  { Icon: Code2, title: 'Build', copy: 'Develop the pages, adapt them for mobile, and connect the agreed inquiry forms and integrations.' },
  { Icon: Rocket, title: 'Launch', copy: 'Review the finished site together, check the key customer journeys, and agree on handoff and any ongoing support.' },
];

export default function WebsiteProcess() {
  return <ol className="website-process process-cards">{stages.map(({ Icon, title, copy }) => <li key={title}>
    <div className="process-card-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.6}/></div>
    <h3>{title}</h3><p>{copy}</p>
  </li>)}</ol>;
}
