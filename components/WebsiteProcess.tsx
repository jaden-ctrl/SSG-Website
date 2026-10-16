const stages = [
  ['Scope & quote', 'Talk through your business, pages, features and priorities. Agree on the scope and quote before work starts.'],
  ['Design', 'Shape the message and visual direction. Review the layout and provide consolidated feedback at the agreed stages.'],
  ['Build', 'Develop the pages, adapt them for mobile, and connect the agreed inquiry forms and integrations.'],
  ['Launch', 'Review the finished site together, check the key customer journeys, and agree on handoff and any ongoing support.'],
];

export default function WebsiteProcess() {
  return <ol className="website-process">{stages.map(([title, copy], index)=><li key={title}><span className="process-number">0{index+1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>;
}
