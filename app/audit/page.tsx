import { CheckCircle2, Search, Workflow, Gauge, Target } from 'lucide-react';
import AuditForm from '@/components/AuditForm';

export const metadata = { title: 'Free Business Audit' };

export default function Audit() {
  return (
    <main>
      <section className="page-hero audit-page">
        <div className="container audit-wrap">
          <div>
            <div className="eyebrow">Free Business Audit</div>
            <h1 className="h2" style={{ fontSize: 'clamp(2.8rem,6vw,5rem)' }}>
              Find where your growth system is leaking.
            </h1>
            <p className="lead">
              This is a diagnostic review, not a sales call disguised as a form. Atlas will use your answers to evaluate how prospects find you, convert, enter your pipeline and get followed up with — then identify the highest-leverage fixes.
            </p>

            <div className="audit-points">
              {[
                'Website & conversion path',
                'Lead capture & follow-up',
                'CRM and pipeline structure',
                'Automation opportunities',
                'Local visibility & demand',
                'Priority action plan',
              ].map((x) => (
                <div key={x}>
                  <CheckCircle2 size={19} color="#5186ff" /> {x}
                </div>
              ))}
            </div>

            <div className="audit-mini-grid">
              <div><Search size={18} /><strong>Diagnose</strong><span>Find friction and leaks.</span></div>
              <div><Gauge size={18} /><strong>Prioritize</strong><span>Rank opportunities by leverage.</span></div>
              <div><Workflow size={18} /><strong>Architect</strong><span>Map how the system should flow.</span></div>
              <div><Target size={18} /><strong>Act</strong><span>Leave with clear next moves.</span></div>
            </div>
          </div>

          <div className="card audit-card">
            <span className="eyebrow">Diagnostic intake</span>
            <h2 style={{ marginTop: 18 }}>Request your audit</h2>
            <p className="muted">Give Atlas enough context to make the review useful. No giant questionnaire.</p>
            <AuditForm />
          </div>
        </div>
      </section>
    </main>
  );
}
