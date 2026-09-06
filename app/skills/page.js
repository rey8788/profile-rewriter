'use client';

import { useState, useEffect } from 'react';

const SAMPLE_SKILLS = 'Zendesk\nCustomer Support\nEmail Support\nHelp Desk\nCustomer Service\nData Entry';
const SAMPLE_SERVICES =
  "I set up and manage Zendesk for e-commerce and SaaS companies — forms, fields, triggers, macros, SLAs, help center articles. I also run day-to-day support operations: ticket queues, team training, and reporting.";
const SAMPLE_JOB_POST =
  "We're looking for a Customer Support Manager to own our Zendesk instance and lead a small support team. Must have experience with Zendesk automation, help center content, SLA management, and reporting/dashboards. Bonus if you've worked with e-commerce fulfillment or Shopify.";

const OVERVIEW_STORAGE_KEY = 'upworkOverview';
const EMAIL_STORAGE_KEY = 'upworkEmail';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHORT_OVERVIEW_THRESHOLD = 120;

export default function SkillsPage() {
  const [skills, setSkills] = useState('');
  const [services, setServices] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('audit');
  const [jobPost, setJobPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noCredits, setNoCredits] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [unlimitedAccess, setUnlimitedAccess] = useState(false);
  const [result, setResult] = useState(null);
  const [hasStoredOverview, setHasStoredOverview] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const hasInput = skills.trim() && (mode === 'audit' || jobPost.trim()) && emailValid;

  // Pick up an overview and email already saved from the Title & Overview tool, if this page hasn't got them yet.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OVERVIEW_STORAGE_KEY);
      if (saved) {
        setHasStoredOverview(true);
        if (!services) setServices(saved);
      }
      const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (savedEmail && !email) setEmail(savedEmail);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServicesChange(e) {
    const value = e.target.value;
    setServices(value);
    try {
      window.localStorage.setItem(OVERVIEW_STORAGE_KEY, value);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
  }

  function handleEmailChange(e) {
    const value = e.target.value;
    setEmail(value);
    try {
      window.localStorage.setItem(EMAIL_STORAGE_KEY, value.trim());
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasInput || loading) return;
    setLoading(true);
    setError('');
    setNoCredits(false);
    setResult(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills,
          services,
          mode,
          jobPost: mode === 'match' ? jobPost : '',
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'email_not_verified') {
          setNeedsVerification(true);
          setLoading(false);
          sendCode();
          return;
        }
        if (data?.error === 'no_credits') {
          setNoCredits(true);
          setCreditsRemaining(0);
        }
        throw new Error(data?.message || 'Something went wrong. Please try again.');
      }
      setNeedsVerification(false);
      setResult(data);
      if (typeof data?.creditsRemaining === 'number') setCreditsRemaining(data.creditsRemaining);
      setUnlimitedAccess(Boolean(data?.unlimitedAccess));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    setSendingCode(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data?.message || 'Could not send a code. Please try again.');
      } else {
        setCodeSent(true);
      }
    } catch (_) {
      setVerifyError('Could not send a code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    if (!verificationCode.trim() || verifyingCode) return;
    setVerifyingCode(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: verificationCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data?.message || 'Could not verify that code.');
        return;
      }
      setNeedsVerification(false);
      setCodeSent(false);
      setVerificationCode('');
      // Verified — automatically continue with the check they were trying to run.
      handleSubmit({ preventDefault: () => {} });
    } catch (_) {
      setVerifyError('Could not verify that code.');
    } finally {
      setVerifyingCode(false);
    }
  }

  function loadSample() {
    setSkills(SAMPLE_SKILLS);
    setServices(SAMPLE_SERVICES);
    if (mode === 'match') setJobPost(SAMPLE_JOB_POST);
  }

  const skillCount = skills
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <nav className="tool-nav">
            <a href="/">Title &amp; Overview</a>
            <a href="/skills" className="active">Skills Optimizer</a>
          </nav>
          <p className="eyebrow">Upwork Profile Builder</p>
          <h1>Skills Optimizer</h1>
          <p>
            For freelancers who aren&apos;t sure which skills to add, drop, or prioritize —
            whether you&apos;re cleaning up your profile in general or trying to match a specific
            job post. Nothing gets invented: real gaps get flagged honestly instead of faked.
          </p>
        </div>
      </section>

      <main className={result ? 'has-results' : ''}>
        <form className="card" onSubmit={handleSubmit}>
          <h2>Your skills</h2>
          <p className="sub">Upwork allows up to 20 skills on a profile.</p>

          <label htmlFor="email">
            Email <span className="hint">(gets you 5 free checks — no spam, just used to track your free checks)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@example.com"
          />

          <label htmlFor="skills">
            Current skills <span className="hint">(one per line, or comma-separated)</span>
          </label>
          <textarea
            id="skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder={'e.g. Zendesk\nCustomer Support\nHelp Desk'}
          />
          <div
            style={{
              fontSize: '0.78rem',
              marginTop: '0.3rem',
              color: skillCount > 20 ? 'var(--weak-ink)' : 'var(--ink-muted)',
            }}
          >
            {skillCount}/20 skills
          </div>

          <label htmlFor="services">
            Your profile overview{' '}
            <span className="hint">(paste your full Upwork overview — the more complete it is, the better the matches)</span>
          </label>
          <textarea
            id="services"
            value={services}
            onChange={handleServicesChange}
            placeholder="Paste your whole Upwork profile overview here — not just a sentence. The full thing gives much better skill matches."
            rows={8}
          />
          {services.trim().length > 0 && services.trim().length < SHORT_OVERVIEW_THRESHOLD && (
            <div
              style={{
                fontSize: '0.78rem',
                marginTop: '0.3rem',
                color: 'var(--weak-ink)',
              }}
            >
              This looks short for a full overview — paste your whole summary for better matches.
            </div>
          )}
          {!services.trim() && !hasStoredOverview && (
            <div
              style={{
                fontSize: '0.82rem',
                marginTop: '0.3rem',
                color: 'var(--ink-muted)',
              }}
            >
              Don&apos;t have your overview handy?{' '}
              <a href="/" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Build it in Title &amp; Overview first →
              </a>
            </div>
          )}

          <label htmlFor="mode-select" style={{ marginBottom: '0.4rem' }}>
            Check type
          </label>
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.2rem' }}>
            <button
              type="button"
              onClick={() => setMode('audit')}
              className="btn"
              style={{
                marginTop: 0,
                background: mode === 'audit' ? 'var(--accent)' : 'var(--paper)',
                color: mode === 'audit' ? 'var(--accent-ink)' : 'var(--ink)',
                border: mode === 'audit' ? 'none' : '1px solid var(--line)',
              }}
            >
              General audit
            </button>
            <button
              type="button"
              onClick={() => setMode('match')}
              className="btn"
              style={{
                marginTop: 0,
                background: mode === 'match' ? 'var(--accent)' : 'var(--paper)',
                color: mode === 'match' ? 'var(--accent-ink)' : 'var(--ink)',
                border: mode === 'match' ? 'none' : '1px solid var(--line)',
              }}
            >
              Match a job post
            </button>
          </div>

          {mode === 'match' && (
            <>
              <label htmlFor="jobPost">
                Job posting <span className="hint">(paste the full listing)</span>
              </label>
              <textarea
                id="jobPost"
                value={jobPost}
                onChange={(e) => setJobPost(e.target.value)}
                placeholder="Paste the job post you're applying to..."
              />
            </>
          )}

          <button className="btn" type="submit" disabled={!hasInput || loading}>
            {loading ? 'Checking your skills…' : 'Check my skills'}
          </button>

          <div className={`status-line ${error && !noCredits && !needsVerification ? 'err' : ''}`}>
            {error && !noCredits && !needsVerification
              ? error
              : loading
              ? 'This usually takes 5–15 seconds.'
              : !error && (
                <button
                  type="button"
                  onClick={loadSample}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Load an example
                </button>
              )}
          </div>

          {unlimitedAccess && !noCredits && !needsVerification && (
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '-0.4rem' }}>
              Unlimited access
            </div>
          )}

          {!unlimitedAccess && creditsRemaining !== null && !noCredits && !needsVerification && (
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '-0.4rem' }}>
              {creditsRemaining} of 5 free checks remaining for this email.
            </div>
          )}

          {needsVerification && (
            <div className="gaps" style={{ marginTop: '1rem' }}>
              <h3>Check your email</h3>
              <p>
                {sendingCode
                  ? 'Sending a 6-digit code to your email…'
                  : codeSent
                  ? `We sent a 6-digit code to ${email.trim()}. Enter it below to unlock your 5 free checks.`
                  : 'We need to verify your email before unlocking your free checks.'}
              </p>
              <label htmlFor="verificationCode" style={{ marginTop: '0.8rem' }}>
                Verification code
              </label>
              <input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
              <button
                type="button"
                className="btn"
                onClick={handleVerifyCode}
                disabled={!verificationCode.trim() || verifyingCode}
                style={{ marginTop: '0.8rem' }}
              >
                {verifyingCode ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="status-line" style={{ marginTop: '0.4rem' }}>
                {verifyError ? (
                  <span style={{ color: '#c14b3a' }}>{verifyError}</span>
                ) : (
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={sendingCode}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'inherit',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    {sendingCode ? 'Sending…' : "Didn't get it? Resend code"}
                  </button>
                )}
              </div>
            </div>
          )}

          {noCredits && (
            <div className="gaps" style={{ marginTop: '1rem' }}>
              <h3>You&apos;re out of free checks</h3>
              <p>
                You&apos;ve used all 5 free checks for this email. Unlimited access is coming soon — for
                now, check out the guides below while you wait.
              </p>
            </div>
          )}
        </form>

        {!result && (
          <div className="card placeholder-card">
            Your results will show up here: a skill-count check, skills worth adding or dropping,
            and a suggested order — matched to a specific job post if you gave one.
          </div>
        )}

        {result && (
          <div className="card">
            <h2>Results</h2>
            <p className="sub">Here&apos;s how your skills check out.</p>

            {mode === 'match' && result.matchScore && result.matchScore.percentage != null && (
              <div className={`match-score ${result.matchScore.recommendation || 'moderate'}`}>
                <div className="pct">{result.matchScore.percentage}%</div>
                <div>
                  <div className="label">
                    {result.matchScore.recommendation === 'strong'
                      ? 'Strong match — go ahead and apply'
                      : result.matchScore.recommendation === 'weak'
                      ? "Not a strong match — don't apply yet"
                      : 'Possible match — address the gaps in your proposal'}
                  </div>
                  <div className="note">{result.matchScore.note}</div>
                  {result.matchScore.recommendation === 'weak' && (
                    <div className="note" style={{ marginTop: '0.4rem', fontWeight: 600 }}>
                      Update your skills and profile overview above to reflect your real experience, then run this
                      check again before spending a connect on this one.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="score-grid">
              <ScoreRow label="Skill count" check={result.skillCountCheck} />
            </div>

            {result.matchedSkills?.length > 0 && (
              <div className="rewrite-block">
                <h3>Already a match</h3>
                <ul className="skill-list">
                  {result.matchedSkills.map((item, i) => (
                    <li key={i}>
                      <strong>{item.skill}</strong> — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.suggestedAdds?.length > 0 && (
              <div className="rewrite-block">
                <h3>
                  Skills to add <span className="tag">Suggested</span>
                </h3>
                <ul className="skill-list">
                  {result.suggestedAdds.map((item, i) => (
                    <li key={i}>
                      <strong>{item.skill}</strong> — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.possibleRemovals?.length > 0 && (
              <div className="rewrite-block">
                <h3>Consider removing</h3>
                <ul className="skill-list">
                  {result.possibleRemovals.map((item, i) => (
                    <li key={i}>
                      <strong>{item.skill}</strong> — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.realGaps?.length > 0 && (
              <div className="gaps">
                <h3>Real gaps for this job</h3>
                <p>Nothing was invented for these — these are things to actually learn or confirm, not fake.</p>
                <ul>
                  {result.realGaps.map((item, i) => (
                    <li key={i}>
                      <strong>{item.skill}</strong> — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.suggestedOrder?.length > 0 && (
              <div className="rewrite-block">
                <h3>
                  Suggested order <span className="tag">Updated</span>
                </h3>
                <div className="rewrite-copy">{result.suggestedOrder.join('\n')}</div>
              </div>
            )}

            {result.interviewPrep?.length > 0 && (
              <div className="rewrite-block">
                <h3>
                  Bonus: practice interview questions <span className="tag">For this job</span>
                </h3>
                <ul className="skill-list">
                  {result.interviewPrep.map((item, i) => (
                    <li key={i}>
                      <strong>{item.question}</strong>
                      <br />
                      <span style={{ color: 'var(--ink-muted)' }}>{item.tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      <footer>
        <div className="cta-strip">
          <span>Built on the Upwork Profile Builder framework.</span>
          <a href="https://stan.store/reymags" target="_blank" rel="noopener noreferrer">
            More guides at my Stan Store →
          </a>
        </div>
      </footer>
    </>
  );
}

function ScoreRow({ label, check }) {
  if (!check) return null;
  const status = check.status === 'pass' ? 'pass' : 'weak';
  return (
    <div className="score-row">
      <span className={`pill ${status}`}>{status}</span>
      <div>
        <div className="label">{label}</div>
        <div className="note">{check.note}</div>
      </div>
    </div>
  );
}
