'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function AtlasReveal() {
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
        const p = Math.min(1, Math.max(0, (innerHeight * .82 - r.top) / Math.max(r.height * .78, 1)));
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

  return (
    <div ref={ref} className="atlas-introduction" style={{'--reveal-progress': progress} as React.CSSProperties}>
      <div className="atlas-intro-grid" aria-hidden="true"/>
      <div className="atlas-intro-vignette" aria-hidden="true"/>
      <div className="atlas-arrival" aria-hidden="true"><span/><i/></div>

      <div className="atlas-hologram" aria-hidden="true">
        <div className="holo-floor"/>
        <div className="holo-ring ring-a"/>
        <div className="holo-ring ring-b"/>
        <div className="holo-ring ring-c"/>
        <div className="atlas-core-3d">
          <span className="core-shell shell-a"/>
          <span className="core-shell shell-b"/>
          <span className="core-shell shell-c"/>
          <b/>
          {Array.from({length:16},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>) }
        </div>
        <div className="atlas-face-wireframe">
          <span className="face-outline"/>
          <span className="face-eye"/>
          <span className="face-scan"/>
        </div>
        <div className="holo-panel panel-left"><small>SYSTEM STATE</small><strong>CONNECTED</strong><span>7 growth layers mapped</span></div>
        <div className="holo-panel panel-right"><small>ATLAS CORE</small><strong>ACTIVE</strong><span>Signal → decision → action</span></div>
      </div>

      <div className="atlas-intro-copy">
        <div className="eyebrow">Meet Atlas</div>
        <h2 className="atlas-intro-title">The intelligence<br/><span>behind the system.</span></h2>
        <p className="lede">Atlas is SSG’s growth intelligence layer—built to connect what your business knows, identify what is slowing it down and turn fragmented signals into a clear next move.</p>
        <div className="atlas-capabilities cinematic-capabilities"><span>Diagnoses constraints</span><span>Connects signals</span><span>Prioritizes action</span></div>
        <Link href="/audit" className="btn btn-primary">Start with Atlas <ArrowRight size={18}/></Link>
      </div>
    </div>
  );
}
