'use client';

import { useState } from 'react';

const SAMPLE_TITLE = 'Customer Support & Ops Specialist | Zendesk Setup | E-Commerce';
const SAMPLE_OVERVIEW =
  "I help e-commerce and SaaS teams stop drowning in support tickets. I set up Zendesk from scratch (forms, fields, triggers, macros, SLAs) and clean up messy help centers so customers actually find answers instead of emailing you. Over 8+ years I've managed support for stores doing six figures a month, cut first-response time in half, and trained teams of up to 6 agents. If your inbox is a mess or your Zendesk was never set up properly, send me a message and I'll tell you exactly what I'd fix first.";

const emptyResult = null;

export default function Home() {
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(emptyResult);

  const hasInput = title.trim() || overview.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasInput || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, overview }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Something went wrong. Please try again.');
      }
      setResult(data);
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

          <label htmlFor="title">
            Title <span className="hint">(the headline under your name)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Customer Support & Ops Specialist | Zendesk Setup | E-Commerce"
          />

          <label htmlFor="overview">
            Overview <span className="hint">(your full profile summary)</span>
          </label>
          <textarea
            id="overview"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Paste your current Upwork overview here..."
          />

          <button className="btn" type="submit" disabled={!hasInput || loading}>
            {loading ? 'Checking your profile…' : 'Check & rewrite'}
          </button>

          <div className={`status-line ${error ? 'err' : ''}`}>
            {error
              ? error
              : loading
              ? 'This usually takes 5–15 seconds.'
              : (
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
