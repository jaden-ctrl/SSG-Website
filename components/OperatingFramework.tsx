'use client';

import { useEffect, useRef, useState } from 'react';

const stages = [
  ['Discover', 'Understand the business, the buyer and the real objective.'],
  ['Build', 'Create the digital and operational foundation.'],
  ['Optimize', 'Remove friction using evidence from the system.'],
  ['Scale', 'Expand what works without multiplying chaos.'],
  ['Audit', 'Diagnose leaks, constraints and missed leverage.'],
  ['Convert', 'Turn attention into qualified opportunities.'],
  ['Automate', 'Make repeatable work happen reliably and faster.'],
] as const;

export default function OperatingFramework() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const activationStart = window.innerHeight * 0.85;
      const activationEnd = window.innerHeight * 0.35;
      const travel = Math.max(rect.height + activationStart - activationEnd, 1);
      const progress = Math.min(Math.max((activationStart - rect.top) / travel, 0), 0.999);
      setActive(Math.min(stages.length - 1, Math.floor(progress * stages.length)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div ref={sectionRef} className="framework-wrap">
    <div className="process">
      {stages.map(([title], index) => <div className={`process-item ${index === active ? 'is-active' : ''}`} key={title} aria-current={index === active ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{title}</div>)}
    </div>
    <div className="framework-detail" aria-live="polite"><span>{String(active + 1).padStart(2, '0')} / 07</span><strong>{stages[active][0]}</strong><p>{stages[active][1]}</p></div>
  </div>;
}
