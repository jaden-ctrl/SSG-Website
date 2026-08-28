'use client';

import { useEffect, useRef, useState } from 'react';

const stages = [
  ['Discover','Find the real constraint.'],
  ['Build','Create the foundation.'],
  ['Optimize','Remove system friction.'],
  ['Scale','Expand what works.'],
  ['Audit','Expose hidden leaks.'],
  ['Convert','Turn attention into action.'],
  ['Automate','Make growth repeatable.'],
] as const;

export default function AtlasFramework() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const r = node.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * .78 - r.top) / Math.max(r.height * .82, 1)));
        setProgress(p);
      });
    };
    update();
    addEventListener('scroll', update, { passive:true });
    addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', update);
      removeEventListener('resize', update);
    };
  }, []);

  const impact = progress > .08;
  const active = Math.min(6, Math.max(-1, Math.floor((progress - .16) / .085)));
  const reforming = progress > .79;

  return (
    <div
      ref={ref}
      className={`atlas-framework cinematic-framework ${impact ? 'has-impact' : ''} ${reforming ? 'is-reforming' : ''}`}
      style={{ '--framework-progress': progress } as React.CSSProperties}
    >
      <div className="energy-descent" aria-hidden="true"><span className="descent-beam"/><i className="descent-core"/></div>
      <div className="impact-shockwave impact-shockwave-a" aria-hidden="true"/>
      <div className="impact-shockwave impact-shockwave-b" aria-hidden="true"/>
      <div className="impact-flare" aria-hidden="true"/>

      <div className="particle-field explosion-field" aria-hidden="true">
        {Array.from({length:64},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>) }
      </div>

      <div className="framework-depth-plane framework-depth-plane-a" aria-hidden="true"/>
      <div className="framework-depth-plane framework-depth-plane-b" aria-hidden="true"/>

      <div className="stage-orbit cinematic-stage-orbit" role="list">
        {stages.map(([title,desc],i)=>{
          const revealed = active >= i || reforming;
          return (
            <article key={title} role="listitem" className={`stage-node ${revealed ? 'is-revealed' : ''} ${active===i ? 'is-active':''}`}>
              <span className="stage-index">0{i+1}</span>
              <div className="stage-energy-shell"><div className="stage-core"/></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          );
        })}
      </div>

      <div className="energy-reform cinematic-reform" aria-hidden="true">
        {Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>) }
        <span className="reformed-core"><b/><em/></span>
      </div>
      <div className="energy-continuation" aria-hidden="true"><span/><i/></div>
    </div>
  );
}
