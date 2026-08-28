'use client';

import { useEffect, useRef, useState } from 'react';

const contour = 'M292 105 C226 104 174 130 143 177 C112 224 110 286 131 334 C145 366 137 389 110 413 C94 427 99 447 119 452 L164 458 C178 468 185 489 184 518 L184 548 L248 548 C253 510 266 479 290 457 C315 435 343 426 374 414 C421 396 453 361 466 319 C479 276 471 228 447 188 C416 136 357 105 292 105 Z';
const route = 'M291 105 C228 104 176 128 144 174 C115 215 109 267 122 312 C132 345 148 367 137 391 C129 410 114 418 105 430 C98 440 105 450 120 452 L164 458 C180 469 186 490 184 518 L184 548 C184 570 184 594 184 620';

export default function AtlasBrain() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [progress, setProgress] = useState(0);
  const [core, setCore] = useState({ x: 291, y: 105 });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current, path = pathRef.current;
        if (!root || !path) return;
        const rect = root.getBoundingClientRect();
        const raw = (innerHeight * .76 - rect.top) / Math.max(rect.height * .9, 1);
        const next = Math.min(1, Math.max(0, raw));
        setProgress(next);
        const point = path.getPointAtLength(path.getTotalLength() * next);
        setCore({ x: point.x, y: point.y });
      });
    };
    update(); addEventListener('scroll', update, { passive:true }); addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', update); removeEventListener('resize', update); };
  }, []);

  return <div ref={rootRef} className="atlas-brain cinematic-brain anatomical-brain" style={{'--atlas-progress':progress} as React.CSSProperties} aria-label="Atlas energy core tracing the perimeter of a human brain">
    <div className="brain-ambient brain-ambient-a"/><div className="brain-ambient brain-ambient-b"/>
    <svg viewBox="0 0 600 650" role="img" aria-hidden="true">
      <defs>
        <filter id="coreGlow" x="-300%" y="-300%" width="600%" height="600%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="brainGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="trace" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff"/><stop offset=".25" stopColor="#b9ceff"/><stop offset=".65" stopColor="#5685ff"/><stop offset="1" stopColor="#1856fd"/></linearGradient>
        <radialGradient id="plasma"><stop stopColor="#fff"/><stop offset=".18" stopColor="#dce8ff"/><stop offset=".48" stopColor="#6f99ff"/><stop offset=".75" stopColor="#275be0"/><stop offset="1" stopColor="#071b58"/></radialGradient>
      </defs>
      <path className="anatomy-depth" d={contour}/><path className="anatomy-shell" d={contour}/>
      <g className="anatomy-folds">
        <path d="M162 205c35-38 72-54 111-45 27 6 39 24 65 22 31-3 55-18 83 12"/><path d="M138 260c36-31 69-36 98-20 28 16 45 10 66-8 25-22 64-20 105 5"/><path d="M139 315c30-24 62-28 92-11 31 18 56 15 80-6 31-28 74-24 123 8"/><path d="M161 365c31-21 62-21 91-2 26 17 52 17 77-1 27-19 58-20 92-4"/><path d="M205 408c27-19 55-18 84 2 25 17 50 16 76-3"/>
        <path d="M205 142c-8 28 0 48 24 60 22 11 26 29 12 53-14 25-7 45 20 61"/><path d="M289 125c-15 25-11 47 12 65 21 16 21 36 1 59-20 23-17 47 9 70"/><path d="M370 139c-19 25-17 49 6 71 21 20 18 42-8 65-22 20-21 44 3 70"/>
      </g>
      <g className="neural-mist">{[[183,190],[239,151],[318,149],[393,181],[155,278],[224,267],[300,230],[382,257],[170,342],[251,342],[335,323],[407,319],[221,399],[305,391],[365,380]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%4===0?3:2}/>)}</g>
      <path ref={pathRef} className="perimeter-guide" d={route}/><path className="perimeter-trace" pathLength="1" d={route}/>
      <g className="cinematic-core" transform={`translate(${core.x} ${core.y})`} filter="url(#coreGlow)"><circle className="core-halo" r="34"/><circle className="core-ring ring-a" r="25"/><circle className="core-ring ring-b" r="19"/><circle className="core-plasma" r="13" fill="url(#plasma)"/><circle className="core-white" r="4"/><circle className="core-particle p1" cx="26" cy="-7" r="2"/><circle className="core-particle p2" cx="-21" cy="14" r="1.6"/></g>
    </svg>
    <div className={`stem-launch ${progress > .94 ? 'is-launching':''}`}><span className="launch-core"/><i/><b/></div>
    <div className="brain-caption"><span className="brain-caption-line"/><small>ATLAS CORE // NEURAL TRACE</small><strong>Follow the energy.</strong></div>
  </div>;
}
