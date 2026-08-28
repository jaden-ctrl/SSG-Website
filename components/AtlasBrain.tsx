'use client';

import { useEffect, useRef, useState } from 'react';

export default function AtlasBrain() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [progress, setProgress] = useState(0);
  const [core, setCore] = useState({ x: 352, y: 292 });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        const path = pathRef.current;
        if (!root || !path) return;

        const rect = root.getBoundingClientRect();
        const raw = (innerHeight * 0.78 - rect.top) / Math.max(rect.height * 0.84, 1);
        const next = Math.min(1, Math.max(0, raw));
        setProgress(next);

        const length = path.getTotalLength();
        const point = path.getPointAtLength(length * next);
        setCore({ x: point.x, y: point.y });
      });
    };

    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', update);
      removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="atlas-brain cinematic-brain"
      style={{ '--atlas-progress': progress } as React.CSSProperties}
      aria-label="Atlas energy core tracing a side-profile neural system"
    >
      <div className="brain-ambient brain-ambient-a" />
      <div className="brain-ambient brain-ambient-b" />
      <svg viewBox="0 0 620 650" role="img" aria-hidden="true">
        <defs>
          <filter id="atlas-core-glow" x="-250%" y="-250%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0.4 0 0 0 0.1  0 0.65 0 0 0.32  0 0 1 0 1  0 0 0 1 0" result="blueBlur" />
            <feMerge><feMergeNode in="blueBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="brain-shell" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d9e4ff" stopOpacity=".8"/>
            <stop offset=".42" stopColor="#668dff"/>
            <stop offset="1" stopColor="#1a55ff" stopOpacity=".32"/>
          </linearGradient>
          <linearGradient id="trace-line" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f8fbff"/><stop offset=".35" stopColor="#78a0ff"/><stop offset="1" stopColor="#1856fd"/>
          </linearGradient>
          <radialGradient id="core-fill">
            <stop offset="0" stopColor="#ffffff"/>
            <stop offset=".25" stopColor="#cfe0ff"/>
            <stop offset=".6" stopColor="#4d7fff"/>
            <stop offset="1" stopColor="#0a2fa8"/>
          </radialGradient>
        </defs>

        <path className="brain-depth-shell" d="M421 91c-78-57-199-42-268 33-50 54-60 131-43 196 11 43 2 73-28 104-13 14-7 36 12 39l56 8 10 98h177l9-111c83-28 138-106 138-193 0-68-21-130-63-174Z"/>
        <path className="brain-silhouette" d="M421 91c-78-57-199-42-268 33-50 54-60 131-43 196 11 43 2 73-28 104-13 14-7 36 12 39l56 8 10 98h177l9-111c83-28 138-106 138-193 0-68-21-130-63-174Z"/>

        <g className="brain-folds">
          <path d="M156 258c35-61 71-105 130-113 52-7 106 15 140 61"/>
          <path d="M152 324c38-38 75-60 125-62 62-2 101 22 143 69"/>
          <path d="M174 392c45-29 88-38 137-27 31 7 60 23 84 48"/>
          <path d="M241 150c-12 47-5 84 22 114 24 27 30 66 13 104"/>
          <path d="M343 145c-22 38-21 77 4 111 26 35 26 70 1 111"/>
        </g>

        <g className="brain-network">
          <path d="M154 253 220 170l85 44 78-65 44 95-72 52 56 73-95 43-70-62-80 55"/>
          <path d="M220 170 246 350m59-136 11 198m67-263-28 147m-109 54 109-54m-135-126 135 126m-189 109 150 7"/>
        </g>

        <g className="brain-nodes">
          {[[154,253],[220,170],[305,214],[383,149],[427,244],[355,296],[411,369],[316,412],[246,350],[166,405]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===5?6:4}/>) }
        </g>

        <path
          ref={pathRef}
          className="core-route-guide"
          pathLength="1"
          d="M355 296C318 248 259 236 220 170C172 88 122 160 154 253C176 317 222 352 246 350C280 347 330 325 355 296C391 254 444 267 427 326C414 371 365 395 316 412C283 423 276 481 274 543C273 570 274 592 276 620"
        />
        <path
          className="core-route-trace"
          pathLength="1"
          d="M355 296C318 248 259 236 220 170C172 88 122 160 154 253C176 317 222 352 246 350C280 347 330 325 355 296C391 254 444 267 427 326C414 371 365 395 316 412C283 423 276 481 274 543C273 570 274 592 276 620"
        />

        <g className="atlas-core-system" transform={`translate(${core.x} ${core.y})`} filter="url(#atlas-core-glow)">
          <circle className="core-orbit core-orbit-a" r="31" />
          <circle className="core-orbit core-orbit-b" r="23" />
          <circle className="core-plasma" r="14" fill="url(#core-fill)" />
          <circle className="core-hotspot" r="5" />
          <circle className="core-spark core-spark-a" cx="22" cy="-8" r="2.2" />
          <circle className="core-spark core-spark-b" cx="-17" cy="13" r="1.8" />
        </g>
      </svg>

      <div className="brain-caption">
        <span className="brain-caption-line" />
        <small>INTELLIGENCE IN MOTION</small>
        <strong>Follow the core.</strong>
      </div>
      <div className="brain-stem-exit" aria-hidden="true"><i/><span/></div>
    </div>
  );
}
