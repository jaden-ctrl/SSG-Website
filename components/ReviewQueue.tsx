'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
} from '@netlify/identity';
import type { PartialAudit } from '@/lib/schemas';

type IdentityUser = Awaited<ReturnType<typeof getUser>>;

type ReviewQueueCase = {
  caseId: string;
  state: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  company: string;
};

type ReviewCase = {
  caseId: string;
  state: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  intake: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    website: string;
    teamSize: string;
    offer: string;
    challenge: string;
    attempts: string;
    goal: string;
    revenueRange: string;
  };
  previewCandidate: PartialAudit | null;
};

type ReviewDecision = 'approved' | 'rejected';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function userEmail(user: IdentityUser) {
  if (!user) return '';
  return (user as { email?: string }).email || '';
}

function userRoles(user: IdentityUser) {
  if (!user) return [];
  const value = user as {
    roles?: unknown;
    app_metadata?: { roles?: unknown };
    appMetadata?: { roles?: unknown };
  };
  const roles = value.roles ?? value.app_metadata?.roles ?? value.appMetadata?.roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : [];
}

function isReviewer(user: IdentityUser) {
  return userRoles(user).includes('ssg-reviewer');
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function extractCases(payload: unknown): ReviewQueueCase[] {
  if (Array.isArray(payload)) return payload as ReviewQueueCase[];
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as { cases?: unknown; items?: unknown; reviews?: unknown };
  const items = data.cases ?? data.items ?? data.reviews;
  return Array.isArray(items) ? items as ReviewQueueCase[] : [];
}

async function responsePayload(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json() as Promise<Record<string, unknown>>;
}

export default function ReviewQueue() {
  const [user, setUser] = useState<IdentityUser>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [cases, setCases] = useState<ReviewQueueCase[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<ReviewCase | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmation, setConfirmation] = useState<ReviewDecision | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState('');
  const confirmationRef = useRef<HTMLDivElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const approveButtonRef = useRef<HTMLButtonElement>(null);
  const holdButtonRef = useRef<HTMLButtonElement>(null);
  const detailRequestRef = useRef(0);
  const queueRequestRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function initializeIdentity() {
      try {
        const callback = await handleAuthCallback();
        if (!active) return;

        if (callback?.type === 'invite' && callback.token) {
          setInviteToken(callback.token);
          setAuthMessage('Choose a password to accept your SSG reviewer invitation.');
        } else if (callback?.type === 'confirmation') {
          setAuthMessage('Your email is confirmed.');
        } else if (callback?.type === 'oauth') {
          setAuthMessage('You are signed in.');
        }

        const callbackUser = callback && 'user' in callback ? callback.user : null;
        setUser(callbackUser || await getUser());
      } catch (error) {
        if (active) setAuthError(messageFrom(error, 'We could not complete the sign-in request.'));
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void initializeIdentity();
    const unsubscribe = onAuthChange((_event, currentUser) => {
      if (active) setUser(currentUser);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    confirmationRef.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    if (selected) detailHeadingRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (!user || !isReviewer(user)) {
      queueRequestRef.current += 1;
      detailRequestRef.current += 1;
      setCases([]);
      setSelectedId('');
      setSelected(null);
      return;
    }
    void loadQueue();
    // Authentication changes are the only automatic refresh trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadQueue() {
    const requestId = ++queueRequestRef.current;
    setQueueLoading(true);
    setQueueError('');
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const data = await responsePayload(response);
      if (!response.ok) {
        const error = typeof data?.error === 'string' ? data.error : 'The review queue could not be loaded.';
        throw new Error(error);
      }
      const pending = extractCases(data)
        .filter((item) => item.state === 'QA_PENDING')
        .sort((left, right) => new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf());
      if (requestId !== queueRequestRef.current) return;
      setCases(pending);
      const nextId = pending.some((item) => item.caseId === selectedId) ? selectedId : pending[0]?.caseId || '';
      if (nextId !== selectedId) {
        setNotes('');
        setConfirmation(null);
        setSelected(null);
      }
      setSelectedId(nextId);
      if (nextId) await loadCase(nextId);
      else {
        detailRequestRef.current += 1;
        setSelected(null);
      }
    } catch (error) {
      if (requestId === queueRequestRef.current) setQueueError(messageFrom(error, 'The review queue could not be loaded.'));
    } finally {
      if (requestId === queueRequestRef.current) setQueueLoading(false);
    }
  }

  async function loadCase(caseId: string) {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setQueueError('');
    try {
      const response = await fetch(`/api/admin/reviews?caseId=${encodeURIComponent(caseId)}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const data = await responsePayload(response);
      if (!response.ok) {
        const error = typeof data?.error === 'string' ? data.error : 'The selected case could not be loaded.';
        throw new Error(error);
      }
      const detail = data?.case;
      if (!detail || typeof detail !== 'object') throw new Error('The selected case response was incomplete.');
      if (requestId === detailRequestRef.current) setSelected(detail as ReviewCase);
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        setSelected(null);
        setQueueError(messageFrom(error, 'The selected case could not be loaded.'));
      }
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  async function selectCase(caseId: string) {
    setSelectedId(caseId);
    setSelected(null);
    setConfirmation(null);
    setNotes('');
    await loadCase(caseId);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    const formData = new FormData(form);
    try {
      const currentUser = await login(String(formData.get('email') || ''), String(formData.get('password') || ''));
      setUser(currentUser);
      setAuthMessage('You are signed in.');
      form.reset();
    } catch (error) {
      setAuthError(messageFrom(error, 'The email or password was not accepted.'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteToken) return;
    const form = event.currentTarget;
    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    const formData = new FormData(form);
    const password = String(formData.get('password') || '');
    const confirmationValue = String(formData.get('passwordConfirmation') || '');
    if (password !== confirmationValue) {
      setAuthError('The passwords do not match.');
      setAuthBusy(false);
      return;
    }
    try {
      const currentUser = await acceptInvite(inviteToken, password);
      setUser(currentUser);
      setInviteToken(null);
      setAuthMessage('Your reviewer account is ready.');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      form.reset();
    } catch (error) {
      setAuthError(messageFrom(error, 'The invitation could not be accepted.'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    setAuthError('');
    try {
      await logout();
      setUser(null);
      queueRequestRef.current += 1;
      setCases([]);
      setSelectedId('');
      setSelected(null);
      setNotes('');
      setConfirmation(null);
      detailRequestRef.current += 1;
      setDecisionMessage('');
    } catch (error) {
      setAuthError(messageFrom(error, 'Sign out failed. Please try again.'));
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitDecision(decision: ReviewDecision) {
    if (!selected || !user) return;
    setDecisionBusy(true);
    setQueueError('');
    setDecisionMessage('');
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          caseId: selected.caseId,
          decision,
          notes: notes.trim() || undefined,
          expectedVersion: selected.version,
        }),
      });
      const data = await responsePayload(response);
      if (!response.ok) {
        const error = typeof data?.error === 'string' ? data.error : 'The review decision could not be saved.';
        if (response.status === 409) await loadQueue();
        throw new Error(error);
      }
      setSelectedId('');
      setSelected(null);
      setNotes('');
      setConfirmation(null);
      setDecisionMessage(decision === 'approved'
        ? `Case ${selected.caseId} was approved and released to the requester.`
        : `Case ${selected.caseId} is held for manual follow-up and remains private.`);
      await loadQueue();
    } catch (error) {
      setQueueError(messageFrom(error, 'The review decision could not be saved.'));
      cancelConfirmation();
    } finally {
      setDecisionBusy(false);
    }
  }

  function cancelConfirmation() {
    const previousDecision = confirmation;
    setConfirmation(null);
    window.requestAnimationFrame(() => {
      if (previousDecision === 'approved') approveButtonRef.current?.focus();
      else holdButtonRef.current?.focus();
    });
  }

  if (authLoading) {
    return <div className="card review-auth-card" aria-live="polite" aria-busy="true">Checking reviewer access…</div>;
  }

  if (inviteToken) {
    return (
      <AuthShell title="Accept your reviewer invitation" message={authMessage} error={authError}>
        <form className="form" onSubmit={handleInvite} aria-busy={authBusy}>
          <label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirm password<input name="passwordConfirmation" type="password" required minLength={8} autoComplete="new-password" /></label>
          <button className="btn btn-primary" disabled={authBusy}>{authBusy ? 'Creating account…' : 'Accept invitation'}</button>
        </form>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell title="SSG reviewer sign in" message={authMessage} error={authError}>
        <form className="form" onSubmit={handleLogin} aria-busy={authBusy}>
          <label>Work email<input name="email" type="email" required autoComplete="username" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn btn-primary" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </AuthShell>
    );
  }

  if (!isReviewer(user)) {
    return (
      <AuthShell title="Reviewer access required" error={authError}>
        <p className="muted">{userEmail(user)} is signed in, but this account does not have the SSG reviewer role. No review data has been loaded.</p>
        <button className="btn btn-secondary" type="button" onClick={handleLogout} disabled={authBusy}>Sign out</button>
      </AuthShell>
    );
  }

  return (
    <div className="review-workspace">
      <header className="review-heading">
        <div>
          <div className="eyebrow">Private SSG workspace</div>
          <h1 className="h2">Audit review queue</h1>
          <p className="muted">Review each draft against the submitted evidence before anything is released.</p>
        </div>
        <div className="review-session">
          <span>Signed in as <strong>{userEmail(user)}</strong></span>
          <button className="btn btn-secondary" type="button" onClick={handleLogout} disabled={authBusy}>Sign out</button>
        </div>
      </header>

      <div className="review-toolbar">
        <p aria-live="polite"><strong>{cases.length}</strong> {cases.length === 1 ? 'case' : 'cases'} awaiting review</p>
        <button className="btn btn-secondary" type="button" onClick={loadQueue} disabled={queueLoading}>{queueLoading ? 'Refreshing…' : 'Refresh queue'}</button>
      </div>

      {queueError && <div className="form-status review-alert" role="alert">{queueError}</div>}
      {decisionMessage && <div className="audit-case-note" role="status">{decisionMessage}</div>}

      {queueLoading && !cases.length ? (
        <div className="card review-empty" aria-live="polite" aria-busy="true">Loading the review queue…</div>
      ) : !cases.length ? (
        <div className="card review-empty">
          <span className="eyebrow">Queue clear</span>
          <h2>No audits are awaiting review.</h2>
          <p className="muted">New completed drafts will appear here for an independent SSG decision.</p>
        </div>
      ) : (
        <div className="review-layout">
          <aside className="card review-queue" aria-label="Audits awaiting review">
            <h2>Pending cases</h2>
            <ul className="review-list">
              {cases.map((item) => {
                const company = item.company || 'Unnamed company';
                const selectedCase = item.caseId === selectedId;
                return (
                  <li key={item.caseId}>
                    <button
                      type="button"
                      className={`review-case-button ${selectedCase ? 'is-selected' : ''}`}
                      aria-current={selectedCase ? 'true' : undefined}
                      onClick={() => void selectCase(item.caseId)}
                    >
                      <span><strong>{company}</strong><span className="pill">Awaiting review</span></span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                      <small>Case {item.caseId}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div aria-busy={detailLoading}>
          {detailLoading ? (
            <div className="card review-empty" role="status">Loading the selected case…</div>
          ) : selected ? (
            <article className="card audit-card review-detail" aria-busy={decisionBusy}>
              <header className="review-detail-heading">
                <div>
                  <span className="eyebrow">Review candidate</span>
                  <h2 ref={detailHeadingRef} tabIndex={-1}>{selected.intake.company || 'Unnamed company'}</h2>
                  <p className="muted">Submitted <time dateTime={selected.createdAt}>{formatDate(selected.createdAt)}</time></p>
                </div>
                <span className="pill">Awaiting SSG decision</span>
              </header>

              <IntakeDetails item={selected} />
              <CandidateDetails audit={selected.previewCandidate} />

              <section className="review-decision" aria-labelledby="review-decision-heading">
                <h3 id="review-decision-heading">Independent review decision</h3>
                <label>Reviewer notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Record evidence checks, corrections or reasons for holding this case." /></label>
                {!confirmation ? (
                  <div className="review-actions">
                    <button ref={approveButtonRef} className="btn btn-primary" type="button" onClick={() => setConfirmation('approved')} disabled={!selected.previewCandidate}>Approve and release</button>
                    <button ref={holdButtonRef} className="btn btn-secondary" type="button" onClick={() => setConfirmation('rejected')}>Hold for manual follow-up</button>
                  </div>
                ) : (
                  <div className="review-confirmation" ref={confirmationRef} tabIndex={-1} role="group" aria-labelledby="review-confirmation-heading">
                    <h4 id="review-confirmation-heading">{confirmation === 'approved' ? 'Confirm approval and release' : 'Confirm manual hold'}</h4>
                    <p>{confirmation === 'approved'
                      ? 'This immediately releases the approved preview to the requester and records you as the reviewer.'
                      : 'This keeps the draft private and moves the case to manual follow-up.'}</p>
                    <div className="review-actions">
                      <button className={confirmation === 'approved' ? 'btn btn-primary' : 'btn btn-secondary'} type="button" onClick={() => submitDecision(confirmation)} disabled={decisionBusy}>
                        {decisionBusy ? 'Saving decision…' : confirmation === 'approved' ? 'Yes, approve and release' : 'Yes, hold this case'}
                      </button>
                      <button className="btn btn-secondary" type="button" onClick={cancelConfirmation} disabled={decisionBusy}>Cancel</button>
                    </div>
                  </div>
                )}
              </section>
            </article>
          ) : (
            <div className="card review-empty">Select a pending case to begin the independent review.</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthShell({ title, message, error, children }: { title: string; message?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="card audit-card review-auth-card">
      <span className="eyebrow">Private SSG workspace</span>
      <h1>{title}</h1>
      <p className="muted">This page is restricted to authorized SSG reviewers.</p>
      {message && <div className="audit-case-note" role="status">{message}</div>}
      {error && <div className="form-status review-alert" role="alert">{error}</div>}
      {children}
    </div>
  );
}

function IntakeDetails({ item }: { item: ReviewCase }) {
  const intake = item.intake || {};
  const details = [
    ['Requester', [intake.firstName, intake.lastName].filter(Boolean).join(' ') || 'Not supplied'],
    ['Work email', intake.email || 'Not supplied'],
    ['Website', intake.website || 'Not supplied'],
    ['Team size', intake.teamSize || 'Not supplied'],
    ['Annual revenue', intake.revenueRange || 'Not supplied'],
  ];
  return (
    <section className="review-section" aria-labelledby="intake-heading">
      <h3 id="intake-heading">Submitted context</h3>
      <dl className="review-meta">
        {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="review-intake-copy">
        <div><h4>What the business sells</h4><p>{intake.offer || 'Not supplied'}</p></div>
        <div><h4>Primary challenge</h4><p>{intake.challenge || 'Not supplied'}</p></div>
        <div><h4>What they already tried</h4><p>{intake.attempts || 'Not supplied'}</p></div>
        <div><h4>12-month goal</h4><p>{intake.goal || 'Not supplied'}</p></div>
      </div>
    </section>
  );
}

function CandidateDetails({ audit }: { audit?: PartialAudit | null }) {
  if (!audit) return <div className="audit-case-note" role="alert">This case does not include a review candidate. Hold it for manual follow-up.</div>;
  return (
    <section className="review-section audit-results" aria-labelledby="candidate-heading">
      <div className="review-candidate-heading">
        <div>
          <span className="eyebrow">Draft audit</span>
          <h3 id="candidate-heading">Candidate assessment</h3>
        </div>
        <div className="audit-score"><strong>{audit.overallScore}</strong><span>/ 100 readiness</span></div>
      </div>
      <p>{audit.executiveSummary}</p>
      <div className="audit-case-note"><strong>Primary constraint:</strong> {audit.primaryConstraint}</div>
      {audit.findings.map((finding) => (
        <article className="audit-finding" key={finding.dimension}>
          <span className="pill">{finding.dimension} · {finding.score}/100</span>
          <h4>{finding.title}</h4>
          <p>{finding.observation}</p>
          <p><strong>Recommended next move:</strong> {finding.recommendation}</p>
        </article>
      ))}
      <div className="review-candidate-grid">
        <div><h4>30-day priority</h4><p>{audit.thirtyDayPriority}</p></div>
        <div><h4>Full-audit opportunity</h4><p>{audit.fullAuditOpportunity}</p></div>
      </div>
      <div>
        <h4>Evidence gaps</h4>
        <ul>{audit.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
        <p className="muted">Confidence: {audit.confidence}</p>
      </div>
    </section>
  );
}
