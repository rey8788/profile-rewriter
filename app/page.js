'use client';

import { useState, useEffect } from 'react';

const SAMPLE_TITLE = 'Customer Support & Ops Specialist | Zendesk Setup | E-Commerce';
const SAMPLE_OVERVIEW =
  "I help e-commerce and SaaS teams stop drowning in support tickets. I set up Zendesk from scratch (forms, fields, triggers, macros, SLAs) and clean up messy help centers so customers actually find answers instead of emailing you. Over 8+ years I've managed support for stores doing six figures a month, cut first-response time in half, and trained teams of up to 6 agents. If your inbox is a mess or your Zendesk was never set up properly, send me a message and I'll tell you exactly what I'd fix first.";

const emptyResult = null;
const OVERVIEW_STORAGE_KEY = 'upworkOverview';
const EMAIL_STORAGE_KEY = 'upworkEmail';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Home() {
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noCredits, setNoCredits] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [result, setResult] = useState(emptyResult);

  const emailValid = EMAIL_RE.test(email.trim());
  const hasInput = (title.trim() || overview.trim()) && emailValid;

  // Pick up an overview and email already saved from the Skills Optimizer tool, if this page hasn't got them yet.
  useEffect(() => {
    try {
      const savedOverview = window.localStorage.getItem(OVERVIEW_STORAGE_KEY);
      if (savedOverview && !overview) setOverview(savedOverview);
      const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (savedEmail && !email) setEmail(savedEmail);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOverviewChange(e) {
    const value = e.target.value;
    setOverview(value);
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
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, overview, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'no_credits') {
          setNoCredits(true);
          setCreditsRemaining(0);
        }
        throw new Error(data?.message || 'Something went wrong. Please try again.');
      }
      setResult(data);
      if (typeof data?.creditsRemaining === 'number') setCreditsRemaining(data.creditsRemaining);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setTitle(SAMPLE_TITLE);
    setOverview(SAMPLE_OVERVIEW);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <nav className="tool-nav">
            <a href="/" className="active">Title &amp; Overview</a>
            <a href="/skills">Skills Optimizer</a>
          </nav>
          <p className="eyebrow">Upwork Profile Builder</p>
          <h1>Title &amp; Overview Rewriter</h1>
          <p>
            For freelancers who aren&apos;t sure what to put in their title and overview, or
            already have something up that still reads generic. Paste what you&apos;ve got and
            it gets checked against the Profile Builder framework, section by section, then
            rewritten wherever it&apos;s weak, using only what you actually gave it.
          </p>
        </div>
      </section>

      <main className={result ? 'has-results' : ''}>
        <form className="card" onSubmit={handleSubmit}>
          <h2>Your profile</h2>
          <p className="sub">Nothing is invented. If something&apos;s missing, it gets flagged instead of made up.</p>

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

          <label htmlFor="title">
            Title <span className="hint">(the headline under your name, 70 characters max)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Customer Support & Ops Specialist | Zendesk Setup | E-Commerce"
          />
          <div
            style={{
              fontSize: '0.78rem',
              marginTop: '0.3rem',
              color: title.length > 70 ? 'var(--weak-ink)' : 'var(--ink-muted)',
            }}
          >
            {title.length}/70 characters
          </div>

          <label htmlFor="overview">
            Overview <span className="hint">(your full profile summary)</span>
          </label>
          <textarea
            id="overview"
            value={overview}
            onChange={handleOverviewChange}
            placeholder="Paste your current Upwork overview here..."
          />

          <button className="btn" type="submit" disabled={!hasInput || loading}>
            {loading ? 'Checking your profile…' : 'Check & rewrite'}
          </button>

          <div className={`status-line ${error && !noCredits ? 'err' : ''}`}>
            {error && !noCredits
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
                  Load an example profile
                </button>
              )}
          </div>

          {creditsRemaining !== null && !noCredits && (
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '-0.4rem' }}>
              {creditsRemaining} of 5 free checks remaining for this email.
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
            Your results will show up here: a pass/weak check on your title and each part of your
            overview, plus a rewritten version wherever it needs work.
          </div>
        )}

        {result && (
          <div className="card">
            <h2>Results</h2>
            <p className="sub">Here&apos;s how your profile checks out against the framework.</p>

            <div className="score-grid">
              <ScoreRow label="Title" check={result.titleCheck} />
              <ScoreRow label="Hook" check={result.overviewCheck?.hook} />
              <ScoreRow label="What I do" check={result.overviewCheck?.whatIDo} />
              <ScoreRow label="How I help" check={result.overviewCheck?.howIHelp} />
              <ScoreRow label="Proof" check={result.overviewCheck?.proof} />
              <ScoreRow label="First 250 characters" check={result.first250} />
            </div>

            {result.titleCheck?.status === 'weak' && result.titleCheck?.rewrittenTitle && (
              <div className="rewrite-block">
                <h3>
                  Rewritten title <span className="tag">Updated</span>
                </h3>
                <div className="rewrite-copy">{result.titleCheck.rewrittenTitle}</div>
              </div>
            )}

            {result.rewrittenOverview && (
              <div className="rewrite-block">
                <h3>
                  Rewritten overview <span className="tag">Updated</span>
                </h3>
                <div className="rewrite-copy">{result.rewrittenOverview}</div>
              </div>
            )}

            {Array.isArray(result.gapsFlagged) && result.gapsFlagged.length > 0 && (
              <div className="gaps">
                <h3>Fill these in yourself</h3>
                <p>Nothing was invented for these — add your own real details here.</p>
                <ul>
                  {result.gapsFlagged.map((gap, i) => (
                    <li key={i}>{gap}</li>
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
