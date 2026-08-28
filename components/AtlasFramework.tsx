'use client';

import { useEffect, useRef, useState } from 'react';

const stages = [
  ['Discover','Find the real constraint.'], ['Build','Create the foundation.'], ['Optimize','Remove system friction.'],
  ['Scale','Expand what works.'], ['Audit','Expose hidden leaks.'], ['Convert','Turn attention into action.'], ['Automate','Make growth repeatable.'],
] as const;

export default function AtlasFramework() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const p = Math.min(.999, Math.max(0, (innerHeight * .72 - r.top) / Math.max(r.height, 1)));
      setActive(Math.floor(p * stages.length));
    };
    update(); addEventListener('scroll', update, { passive:true });
    return () => removeEventListener('scroll', update);
  }, []);
  return <div ref={ref} className="atlas-framework">
    <div className="energy-entry"><span /></div>
    <div className="particle-field" aria-hidden="true">{Array.from({length:28},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
    <div className="stage-orbit" role="list">{stages.map(([title,desc],i)=><article key={title} role="listitem" className={`stage-node ${i===active?'is-active':''}`}>
      <span className="stage-index">0{i+1}</span><div className="stage-core"/><h3>{title}</h3><p>{desc}</p>
    </article>)}</div>
    <div className="energy-reform" aria-hidden="true"><i/><i/><i/><span/></div>
  </div>;
}
