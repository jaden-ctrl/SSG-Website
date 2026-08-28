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

      const mobile = window.matchMedia('(max-width: 720px)').matches;

      if (mobile) {
        const process = node.querySelector<HTMLElement>('.process');
        if (!process) return;

        const rect = process.getBoundingClientRect();
        const readingLine = Math.min(window.innerHeight * 0.58, 500);
        const start = readingLine + 70;
        const end = readingLine - Math.max(rect.height - 90, 1);
        const travel = Math.max(start - end, 1);
        const progress = Math.min(Math.max((start - rect.top) / travel, 0), 0.999);

        setActive(Math.min(stages.length - 1, Math.floor(progress * stages.length)));
        return;
      }

      const rect = node.getBoundingClientRect();
      const activationStart = window.innerHeight * 0.85;
      const activationEnd = window.innerHeight * 0.35;
      const travel = Math.max(rect.height + activationStart - activationEnd, 1);
      const progress = Math.min(Math.max((activationStart - rect.top) / travel, 0), 0.999);
      setActive(Math.min(stages.length - 1, Math.floor(progress * stages.length)));
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={sectionRef} className="framework-wrap framework-wrap-v41">
      <div className="process">
        {stages.map(([title], index) => (
          <div
            className={`process-item ${index === active ? 'is-active' : ''}`}
            key={title}
            aria-current={index === active ? 'step' : undefined}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {title}
          </div>
        ))}
      </div>

      <div className="framework-detail" aria-live="polite">
        <span>{String(active + 1).padStart(2, '0')} / 07</span>
        <strong>{stages[active][0]}</strong>
        <p>{stages[active][1]}</p>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .framework-wrap-v41 {
            display: flex;
            flex-direction: column;
            position: relative;
            margin-top: 28px;
          }

          .framework-wrap-v41 .framework-detail {
            order: 1;
            position: sticky;
            top: 92px;
            z-index: 35;
            min-height: 132px;
            margin: 0 0 22px;
            padding: 18px 20px;
            grid-template-columns: 1fr;
            gap: 3px;
            align-items: start;
            background: rgba(8, 11, 16, 0.90);
            border-color: rgba(95, 134, 255, 0.34);
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
            -webkit-backdrop-filter: blur(18px);
            backdrop-filter: blur(18px);
          }

          .framework-wrap-v41 .framework-detail > span {
            grid-row: auto;
            margin-bottom: 2px;
          }

          .framework-wrap-v41 .framework-detail strong {
            font-size: 1.42rem;
            line-height: 1.15;
          }

          .framework-wrap-v41 .framework-detail p {
            font-size: 0.94rem;
            line-height: 1.45;
          }

          .framework-wrap-v41 .process {
            order: 2;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding-bottom: 34px;
          }

          .framework-wrap-v41 .process-item {
            min-height: 112px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .framework-wrap-v41 .process-item.is-active {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
