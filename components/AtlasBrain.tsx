'use client';

import { useEffect, useRef, useState } from 'react';

export default function AtlasBrain() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setProgress(Math.min(1, Math.max(0, (innerHeight * .82 - rect.top) / (rect.height + innerHeight * .32))));
    };
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    return () => { removeEventListener('scroll', update); removeEventListener('resize', update); };
  }, []);

  return <div ref={ref} className="atlas-brain" style={{ '--atlas-progress': progress } as React.CSSProperties} aria-label="Atlas intelligence mapping a connected growth system">
    <div className="brain-status"><i /> ATLAS ONLINE <span>GROWTH INTELLIGENCE</span></div>
    <svg viewBox="0 0 620 650" role="img" aria-hidden="true">
      <defs>
        <filter id="core-glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="brain-line" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#82a4ff"/><stop offset="1" stopColor="#1856fd"/></linearGradient>
      </defs>
      <path className="brain-silhouette" d="M419 91c-76-55-196-42-264 32-50 54-59 130-43 194 11 43 2 73-27 103-13 14-7 36 12 39l54 8 9 99h176l9-113c82-28 137-105 137-191 0-67-21-128-63-171Z"/>
      <g className="brain-network">
        <path d="M154 253 220 170l85 44 78-65 44 95-72 52 56 73-95 43-70-62-80 55"/>
        <path d="M220 170 246 350m59-136 11 198m67-263-28 147m-109 54 109-54m-135-126 135 126m-189 109 150 7"/>
      </g>
      <g className="brain-nodes">{[[154,253],[220,170],[305,214],[383,149],[427,244],[355,296],[411,369],[316,412],[246,350],[166,405]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===5?8:5}/>)}</g>
      <path className="core-route" pathLength="1" d="M118 421C160 390 155 275 220 170s176 4 207 74-26 130-111 168c-30 13-47 67-48 138"/>
      <circle className="atlas-core" cx="355" cy="296" r="14" filter="url(#core-glow)"/>
    </svg>
    <div className="brain-readout"><span>01 / DISCOVER</span><strong>Signal becomes strategy.</strong><small>Atlas sees the handoffs between demand, conversion, delivery and growth.</small></div>
  </div>;
}
