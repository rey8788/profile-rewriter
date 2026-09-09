'use client';

import { useState, useEffect } from 'react';

const SAMPLE_TITLE = 'Customer Support & Ops Specialist | Zendesk Setup | E-Commerce';
const SAMPLE_OVERVIEW =
  "I help e-commerce and SaaS teams stop drowning in support tickets. I set up Zendesk from scratch (forms, fields, triggers, macros, SLAs) and clean up messy help centers so customers actually find answers instead of emailing you. Over 8+ years I've managed support for stores doing six figures a month, cut first-response time in half, and trained teams of up to 6 agents. If your inbox is a mess or your Zendesk was never set up properly, send me a message and I'll tell you exactly what I'd fix first.";
const SAMPLE_SKILLS = 'Zendesk\nCustomer Support\nEmail Support\nHelp Desk\nCustomer Service\nData Entry';
const SAMPLE_SERVICES =
  "I set up and manage Zendesk for e-commerce and SaaS companies — forms, fields, triggers, macros, SLAs, help center articles. I also run day-to-day support operations: ticket queues, team training, and reporting.";
const SAMPLE_JOB_POST =
  "We're looking for a Customer Support Manager to own our Zendesk instance and lead a small support team. Must have experience with Zendesk automation, help center content, SLA management, and reporting/dashboards. Bonus if you've worked with e-commerce fulfillment or Shopify.";

const OVERVIEW_STORAGE_KEY = 'upworkOverview';
const EMAIL_STORAGE_KEY = 'upworkEmail';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHORT_OVERVIEW_THRESHOLD = 120;
const SUBSCRIBE_URL = 'https://stan.store/reymags/p/profile-rewriter--unlimited-access';
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TABS = [
  { key: 'scan', num: 1, label: 'Profile Scan' },
  { key: 'rewrite', num: 2, label: 'Title & Overview' },
  { key: 'match', num: 3, label: 'Job Match & Proposal' },
];

const HERO_COPY = {
  scan: {
    h1: 'Is your profile actually complete?',
    p: "Upload a screenshot (or a few) of your full Upwork profile page and we'll check it section by section — photo, rate, skills, portfolio, work history, and more. Upwork's own completeness meter should already say 100%, this is just a second pair of eyes.",
  },
  rewrite: {
    h1: 'Title & Overview Rewriter',
    p: "For freelancers who aren't sure what to put in their title and overview, or already have something up that still reads generic. Paste what you've got and it gets checked against the Profile Builder framework, section by section, then rewritten wherever it's weak, using only what you actually gave it.",
  },
  match: {
    h1: 'Are You a Match for This Job?',
    p: "Paste in a job posting and we'll check it against your skills and profile — see your match score, what's already covered, and the real gaps worth fixing before you spend a connect applying. No job posting yet? We'll run a full skills audit instead. Then, when you're ready, get a full proposal written for you.",
  },
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  // ---- shared: email, verification, credits ----
  const [email, setEmail] = useState('');
  const [creditsTotal, setCreditsTotal] = useState(null);
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [unlimitedAccess, setUnlimitedAccess] = useState(false);
  const [noCredits, setNoCredits] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [lastAction, setLastAction] = useState(null);

  // ---- tabs ----
  const [activeTab, setActiveTab] = useState('scan');

  // ---- Tab 1: profile scan ----
  const [scanImages, setScanImages] = useState([]); // [{ name, size, dataUrl }]
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // ---- Tab 2: title & overview ----
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);

  // ---- Tab 3: job match + proposal ----
  const [skills, setSkills] = useState('');
  const [services, setServices] = useState('');
  const [mode, setMode] = useState('audit');
  const [jobPost, setJobPost] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalResult, setProposalResult] = useState(null);
  const [proposalCopied, setProposalCopied] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  // Pick up an overview and email already saved from a previous visit.
  useEffect(() => {
    try {
      const savedOverview = window.localStorage.getItem(OVERVIEW_STORAGE_KEY);
      if (savedOverview) {
        if (!overview) setOverview(savedOverview);
        if (!services) setServices(savedOverview);
      }
      const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (savedEmail && !email) setEmail(savedEmail);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The free-credit pool size can change automatically on a date (see credits.js),
  // so grab the current number to show before anyone submits anything.
  useEffect(() => {
    fetch('/api/credits-info')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.total === 'number') setCreditsTotal(data.total);
      })
      .catch(() => {
        /* not critical — the hint just falls back to generic wording */
      });
  }, []);

  function handleEmailChange(e) {
    const value = e.target.value;
    setEmail(value);
    try {
      window.localStorage.setItem(EMAIL_STORAGE_KEY, value.trim());
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
  }

  function handleOverviewChange(e) {
    const value = e.target.value;
    setOverview(value);
    try {
      window.localStorage.setItem(OVERVIEW_STORAGE_KEY, value);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
  }

  // Shared handling for any tool's fetch response — verification / no-credits / totals
  // all funnel through here so we only have one panel for it instead of three.
  function handleApiFailure(data) {
    if (data?.error === 'email_not_verified') {
      setNeedsVerification(true);
      sendCode();
      return true;
    }
    if (data?.error === 'no_credits') {
      setNoCredits(true);
      setCreditsRemaining(0);
    }
    if (typeof data?.total === 'number') setCreditsTotal(data.total);
    return false;
  }

  function handleApiSuccess(data) {
    setNeedsVerification(false);
    setNoCredits(false);
    if (typeof data?.creditsRemaining === 'number') setCreditsRemaining(data.creditsRemaining);
    if (typeof data?.creditsTotal === 'number') setCreditsTotal(data.creditsTotal);
    setUnlimitedAccess(Boolean(data?.unlimitedAccess));
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

  function retryLastAction() {
    if (lastAction === 'scan') return handleScan();
    if (lastAction === 'rewrite') return handleRewrite();
    if (lastAction === 'match') return handleMatch();
    if (lastAction === 'proposal') return handleProposal();
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
      retryLastAction();
    } catch (_) {
      setVerifyError('Could not verify that code.');
    } finally {
      setVerifyingCode(false);
    }
  }

  // ---- Tab 1: profile scan ----
  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_IMAGES);
    e.target.value = '';
    if (files.length === 0) return;
    setScanError('');
    const oversized = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setScanError(`"${oversized.name}" is over 5MB — try a smaller screenshot or crop it down.`);
      return;
    }
    try {
      const urls = await Promise.all(files.map(fileToDataUrl));
      setScanImages((prev) =>
        [...prev, ...files.map((f, i) => ({ name: f.name, size: f.size, dataUrl: urls[i] }))].slice(0, MAX_IMAGES)
      );
    } catch (_) {
      setScanError('Could not read one of those images. Try again.');
    }
  }

  function removeScanImage(index) {
    setScanImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleScan(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!emailValid || scanImages.length === 0 || scanLoading) return;
    setLastAction('scan');
    setScanLoading(true);
    setScanError('');
    setNoCredits(false);
    try {
      const res = await fetch('/api/scan-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: scanImages.map((img) => img.dataUrl),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const handled = handleApiFailure(data);
        if (!handled) throw new Error(data?.message || 'Something went wrong. Please try again.');
        return;
      }
      handleApiSuccess(data);
      setScanResult(data);
      setScanModalOpen(true);
    } catch (err) {
      setScanError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setScanLoading(false);
    }
  }

  // ---- Tab 2: title & overview ----
  async function handleRewrite(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!emailValid || (!title.trim() && !overview.trim()) || rewriteLoading) return;
    setLastAction('rewrite');
    setRewriteLoading(true);
    setRewriteError('');
    setNoCredits(false);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, overview, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const handled = handleApiFailure(data);
        if (!handled) throw new Error(data?.message || 'Something went wrong. Please try again.');
        return;
      }
      handleApiSuccess(data);
      setRewriteResult(data);
      setRewriteModalOpen(true);
    } catch (err) {
      setRewriteError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setRewriteLoading(false);
    }
  }

  function loadRewriteSample() {
    setTitle(SAMPLE_TITLE);
    setOverview(SAMPLE_OVERVIEW);
  }

  // ---- Tab 3: job match + proposal ----
  const skillCount = skills
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const hasMatchInput = skills.trim() && (mode === 'audit' || jobPost.trim());

  async function handleMatch(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!emailValid || !hasMatchInput || matchLoading) return;
    setLastAction('match');
    setMatchLoading(true);
    setMatchError('');
    setNoCredits(false);
    setProposalResult(null);
    setProposalError('');
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
        const handled = handleApiFailure(data);
        if (!handled) throw new Error(data?.message || 'Something went wrong. Please try again.');
        return;
      }
      handleApiSuccess(data);
      setMatchResult(data);
      setMatchModalOpen(true);
    } catch (err) {
      setMatchError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setMatchLoading(false);
    }
  }

  function loadMatchSample() {
    setSkills(SAMPLE_SKILLS);
    setServices(SAMPLE_SERVICES);
    if (mode === 'match') setJobPost(SAMPLE_JOB_POST);
  }

  function useOverviewFromRewrite() {
    setServices(rewriteResult?.rewrittenOverview || overview);
  }

  async function handleCopyProposal() {
    if (!proposalResult?.proposal) return;
    try {
      await navigator.clipboard.writeText(proposalResult.proposal);
      setProposalCopied(true);
      setTimeout(() => setProposalCopied(false), 2000);
    } catch (_) {
      /* clipboard unavailable — the text is still right there to select and copy */
    }
  }

  async function handleProposal() {
    if (proposalLoading) return;
    setLastAction('proposal');
    setProposalLoading(true);
    setProposalError('');
    setNoCredits(false);
    setProposalCopied(false);
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobPost, skills, services, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const handled = handleApiFailure(data);
        if (!handled) throw new Error(data?.message || 'Something went wrong. Please try again.');
        return;
      }
      handleApiSuccess(data);
      setProposalResult(data);
    } catch (err) {
      setProposalError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setProposalLoading(false);
    }
  }

  const hero = HERO_COPY[activeTab];

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Upwork Freelancer Toolkit</p>
          <StepNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            done={{ scan: Boolean(scanResult), rewrite: Boolean(rewriteResult), match: Boolean(matchResult) }}
          />
          <h1>{hero.h1}</h1>
          <p>{hero.p}</p>
        </div>
      </section>

      <main className="flow-main">
        <div className="card email-card">
          <label htmlFor="email">
            Email{' '}
            <span className="hint">
              (gets you {creditsTotal != null ? `${creditsTotal} free credits` : 'free credits'}, shared across
              every tab on this page — no spam, just used to track usage)
            </span>
          </label>
          <input id="email" type="email" value={email} onChange={handleEmailChange} placeholder="you@example.com" />

          {unlimitedAccess && !noCredits && !needsVerification && (
            <div className="credit-line">Unlimited access</div>
          )}
          {!unlimitedAccess && creditsRemaining !== null && !noCredits && !needsVerification && (
            <div className="credit-line">
              {creditsRemaining} of {creditsTotal ?? creditsRemaining} free credits remaining, shared across every
              tab.{' '}
              <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer">
                Want unlimited checks? Subscribe &rarr;
              </a>
            </div>
          )}

          {needsVerification && (
            <div className="gaps" style={{ marginTop: '1rem' }}>
              <h3>Check your email</h3>
              <p>
                {sendingCode
                  ? 'Sending a 6-digit code to your email…'
                  : codeSent
                  ? `We sent a 6-digit code to ${email.trim()}. Enter it below to unlock your ${creditsTotal ?? ''} free credits.`
                  : 'We need to verify your email before unlocking your free credits.'}
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
                  <button type="button" onClick={sendCode} disabled={sendingCode} className="link-btn">
                    {sendingCode ? 'Sending…' : "Didn't get it? Resend code"}
                  </button>
                )}
              </div>
            </div>
          )}

          {noCredits && (
            <div className="gaps" style={{ marginTop: '1rem' }}>
              <h3>You&apos;re out of free credits</h3>
              <p>
                You&apos;ve used all {creditsTotal ?? 'your'} free credits, shared across every tab. Subscribe to
                Profile Rewriter Unlimited to keep going as often as you want.
              </p>
              <a href={SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                Subscribe for unlimited access &rarr;
              </a>
            </div>
          )}
        </div>

        {activeTab === 'scan' && (
          <ScanTab
            emailValid={emailValid}
            scanImages={scanImages}
            onFilesSelected={handleFilesSelected}
            onRemoveImage={removeScanImage}
            onSubmit={handleScan}
            loading={scanLoading}
            error={scanError}
            hasResult={Boolean(scanResult)}
            onViewResults={() => setScanModalOpen(true)}
            onSkip={() => setActiveTab('rewrite')}
          />
        )}

        {activeTab === 'rewrite' && (
          <RewriteTab
            title={title}
            setTitle={setTitle}
            overview={overview}
            onOverviewChange={handleOverviewChange}
            emailValid={emailValid}
            onSubmit={handleRewrite}
            loading={rewriteLoading}
            error={rewriteError}
            onLoadSample={loadRewriteSample}
            hasResult={Boolean(rewriteResult)}
            onViewResults={() => setRewriteModalOpen(true)}
          />
        )}

        {activeTab === 'match' && (
          <MatchTab
            skills={skills}
            setSkills={setSkills}
            services={services}
            onServicesChange={(e) => setServices(e.target.value)}
            mode={mode}
            setMode={setMode}
            jobPost={jobPost}
            setJobPost={setJobPost}
            skillCount={skillCount}
            emailValid={emailValid}
            hasMatchInput={hasMatchInput}
            onSubmit={handleMatch}
            loading={matchLoading}
            error={matchError}
            onLoadSample={loadMatchSample}
            hasResult={Boolean(matchResult)}
            onViewResults={() => setMatchModalOpen(true)}
            hasRewriteOverview={Boolean(rewriteResult?.rewrittenOverview || overview.trim())}
            onUseOverview={useOverviewFromRewrite}
          />
        )}
      </main>

      {scanModalOpen && scanResult && (
        <Modal
          title="Profile scan results"
          subtitle={scanResult.summary}
          onClose={() => setScanModalOpen(false)}
          footer={
            <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => { setScanModalOpen(false); setActiveTab('rewrite'); }}>
              Next: Rewrite my title &amp; overview →
            </button>
          }
        >
          <div className="checklist">
            {(scanResult.sections || []).map((row, i) => (
              <ChecklistRow key={i} item={row.item} status={row.status} note={row.note} />
            ))}
          </div>
          {scanResult.rateSuggestion && scanResult.rateSuggestion.suggestedRange && (
            <div className="rate-suggestion">
              <div className="rate-suggestion-label">Suggested rate</div>
              <div className="rate-suggestion-value">{scanResult.rateSuggestion.suggestedRange}</div>
              <div className="rate-suggestion-meta">
                {scanResult.rateSuggestion.category}
                {scanResult.rateSuggestion.experienceLevel ? ` · ${scanResult.rateSuggestion.experienceLevel}` : ''}
              </div>
              {scanResult.rateSuggestion.note && (
                <div className="rate-suggestion-note">{scanResult.rateSuggestion.note}</div>
              )}
            </div>
          )}
          {Array.isArray(scanResult.flaggedItems) && scanResult.flaggedItems.length > 0 && (
            <div className="gaps" style={{ marginTop: '1.4rem' }}>
              <h3>Worth fixing</h3>
              <ul>
                {scanResult.flaggedItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {rewriteModalOpen && rewriteResult && (
        <Modal
          title="Your rewrite is ready"
          subtitle="Here's how your title and overview check out against the framework."
          onClose={() => setRewriteModalOpen(false)}
          footer={
            <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => { setRewriteModalOpen(false); setActiveTab('match'); }}>
              Next: Match a job &amp; write a proposal →
            </button>
          }
        >
          <div className="score-grid">
            <ScoreRow label="Title" check={rewriteResult.titleCheck} />
            <ScoreRow label="Hook" check={rewriteResult.overviewCheck?.hook} />
            <ScoreRow label="What I do" check={rewriteResult.overviewCheck?.whatIDo} />
            <ScoreRow label="How I help" check={rewriteResult.overviewCheck?.howIHelp} />
            <ScoreRow label="Proof" check={rewriteResult.overviewCheck?.proof} />
            <ScoreRow label="First 250 characters" check={rewriteResult.first250} />
          </div>

          {rewriteResult.titleCheck?.status === 'weak' && rewriteResult.titleCheck?.rewrittenTitle && (
            <div className="rewrite-block">
              <h3>
                Rewritten title <span className="tag">Updated</span>
              </h3>
              <div className="rewrite-copy">{rewriteResult.titleCheck.rewrittenTitle}</div>
            </div>
          )}

          {rewriteResult.rewrittenOverview && (
            <div className="rewrite-block">
              <h3>
                Rewritten overview <span className="tag">Updated</span>
              </h3>
              <div className="rewrite-copy">{rewriteResult.rewrittenOverview}</div>
            </div>
          )}

          {Array.isArray(rewriteResult.gapsFlagged) && rewriteResult.gapsFlagged.length > 0 && (
            <div className="gaps">
              <h3>Fill these in yourself</h3>
              <p>Nothing was invented for these — add your own real details here.</p>
              <ul>
                {rewriteResult.gapsFlagged.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {matchModalOpen && matchResult && (
        <Modal title="Job match results" subtitle="Here's how your skills check out." onClose={() => setMatchModalOpen(false)}>
          {mode === 'match' && matchResult.matchScore && matchResult.matchScore.percentage != null && (
            <div className={`match-score ${matchResult.matchScore.recommendation || 'moderate'}`}>
              <div className="pct">{matchResult.matchScore.percentage}%</div>
              <div>
                <div className="label">
                  {matchResult.matchScore.recommendation === 'strong'
                    ? 'Strong match — go ahead and apply'
                    : matchResult.matchScore.recommendation === 'weak'
                    ? "Not a strong match — don't apply yet"
                    : 'Possible match — address the gaps in your proposal'}
                </div>
                <div className="note">{matchResult.matchScore.note}</div>
              </div>
            </div>
          )}

          <div className="score-grid">
            <ScoreRow label="Skill count" check={matchResult.skillCountCheck} />
          </div>

          {matchResult.matchedSkills?.length > 0 && (
            <div className="rewrite-block">
              <h3>Already a match</h3>
              <ul className="skill-list">
                {matchResult.matchedSkills.map((item, i) => (
                  <li key={i}>
                    <strong>{item.skill}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matchResult.suggestedAdds?.length > 0 && (
            <div className="rewrite-block">
              <h3>
                Skills to add <span className="tag">Suggested</span>
              </h3>
              <ul className="skill-list">
                {matchResult.suggestedAdds.map((item, i) => (
                  <li key={i}>
                    <strong>{item.skill}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matchResult.possibleRemovals?.length > 0 && (
            <div className="rewrite-block">
              <h3>Consider removing</h3>
              <ul className="skill-list">
                {matchResult.possibleRemovals.map((item, i) => (
                  <li key={i}>
                    <strong>{item.skill}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matchResult.realGaps?.length > 0 && (
            <div className="gaps">
              <h3>Real gaps for this job</h3>
              <p>Nothing was invented for these — these are things to actually learn or confirm, not fake.</p>
              <ul>
                {matchResult.realGaps.map((item, i) => (
                  <li key={i}>
                    <strong>{item.skill}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matchResult.suggestedOrder?.length > 0 && (
            <div className="rewrite-block">
              <h3>
                Suggested order <span className="tag">Updated</span>
              </h3>
              <div className="rewrite-copy">{matchResult.suggestedOrder.join('\n')}</div>
            </div>
          )}

          {mode === 'match' && jobPost.trim() && (
            <div className="rewrite-block">
              {!proposalResult ? (
                <>
                  <h3>Ready to submit a proposal?</h3>
                  <p className="sub">
                    Get a cover letter for this exact job, built with the Upwork Proposal Builder framework (Hook,
                    Help, Proof, Next Step) — using only what you told us about your skills and experience. This
                    uses 1 of your free credits.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: '0.8rem', width: 'auto' }}
                    onClick={handleProposal}
                    disabled={proposalLoading}
                  >
                    {proposalLoading ? 'Writing your proposal…' : 'Yes, write my proposal'}
                  </button>
                </>
              ) : (
                <>
                  <h3>
                    Your proposal <span className="tag">Ready to send</span>
                  </h3>
                  <p className="sub">Copy this into the Upwork proposal box, personalize the greeting, and send it.</p>
                  <div className="rewrite-copy" style={{ marginTop: '0.6rem' }}>
                    {proposalResult.proposal}
                  </div>

                  <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn" style={{ marginTop: 0, width: 'auto' }} onClick={handleCopyProposal}>
                      {proposalCopied ? 'Copied ✓' : 'Copy proposal'}
                    </button>
                    <button type="button" onClick={handleProposal} disabled={proposalLoading} className="link-btn muted">
                      {proposalLoading ? 'Writing…' : 'Regenerate (uses another credit)'}
                    </button>
                  </div>

                  {proposalResult.suggestedQuestion && (
                    <div className="tip-block">
                      <strong>Worth asking the client</strong>
                      {proposalResult.suggestedQuestion}
                    </div>
                  )}

                  {Array.isArray(proposalResult.gapsFlagged) && proposalResult.gapsFlagged.length > 0 && (
                    <div className="gaps" style={{ marginTop: '0.8rem' }}>
                      <h3>Fill these in yourself</h3>
                      <p>Nothing was invented for these — add your own real details before sending.</p>
                      <ul>
                        {proposalResult.gapsFlagged.map((gap, i) => (
                          <li key={i}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {proposalError && (
                <div className="status-line err" style={{ marginTop: '0.6rem' }}>
                  {proposalError}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      <footer>
        <div className="cta-strip">
          <span>Built on my Upwork Profile Builder and Proposal Builder frameworks.</span>
          <a href="https://stan.store/reymags" target="_blank" rel="noopener noreferrer">
            More guides at my Stan Store →
          </a>
        </div>
      </footer>
    </>
  );
}

function StepNav({ activeTab, setActiveTab, done }) {
  return (
    <nav className="step-nav">
      {TABS.map((tab, i) => (
        <button
          type="button"
          key={tab.key}
          className={`step ${activeTab === tab.key ? 'active' : ''} ${done[tab.key] ? 'done' : ''}`}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className="step-num">{done[tab.key] ? '✓' : tab.num}</span>
          <span className="step-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Modal({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-header">
          {title && <h2>{title}</h2>}
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ScanTab({
  emailValid,
  scanImages,
  onFilesSelected,
  onRemoveImage,
  onSubmit,
  loading,
  error,
  hasResult,
  onViewResults,
  onSkip,
}) {
  const canSubmit = emailValid && scanImages.length > 0 && !loading;
  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Upload your profile screenshot</h2>
      <p className="sub">
        A full-page screenshot works best. If your profile is long, split it into 2–3 screenshots and upload them
        together — nothing gets invented for parts we can&apos;t see. Include your work history and completed jobs
        if you can — that&apos;s what unlocks a suggested rate range based on your actual experience.
      </p>

      <label htmlFor="scan-upload" className="dropzone">
        <span className="dropzone-title">Choose screenshot{scanImages.length ? 's' : ''}</span>
        <span className="dropzone-hint">PNG, JPG, WEBP, or GIF — up to {MAX_IMAGES}, 5MB each</span>
        <input
          id="scan-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={onFilesSelected}
          style={{ display: 'none' }}
        />
      </label>

      {scanImages.length > 0 && (
        <ul className="file-list">
          {scanImages.map((img, i) => (
            <li key={i}>
              <span className="file-name">{img.name}</span>
              <span className="file-size">{(img.size / 1024 / 1024).toFixed(1)}MB</span>
              <button type="button" className="file-remove" onClick={() => onRemoveImage(i)} aria-label={`Remove ${img.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn" type="submit" disabled={!canSubmit}>
        {loading ? 'Scanning your profile…' : 'Scan my profile'}
      </button>

      <div className={`status-line ${error ? 'err' : ''}`}>
        {error ? error : loading ? 'This usually takes 10–20 seconds.' : !emailValid ? 'Add your email above first.' : ' '}
      </div>

      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {hasResult && (
          <button type="button" onClick={onViewResults} className="link-btn">
            View last results
          </button>
        )}
        <button type="button" onClick={onSkip} className="link-btn muted">
          Skip this — go straight to Title &amp; Overview →
        </button>
      </div>
    </form>
  );
}

function RewriteTab({ title, setTitle, overview, onOverviewChange, emailValid, onSubmit, loading, error, onLoadSample, hasResult, onViewResults }) {
  const canSubmit = emailValid && (title.trim() || overview.trim()) && !loading;
  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Your profile</h2>
      <p className="sub">Nothing is invented. If something&apos;s missing, it gets flagged instead of made up.</p>

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
      <textarea id="overview" value={overview} onChange={onOverviewChange} placeholder="Paste your current Upwork overview here..." />

      <button className="btn" type="submit" disabled={!canSubmit}>
        {loading ? 'Checking your profile…' : 'Check & rewrite'}
      </button>

      <div className={`status-line ${error ? 'err' : ''}`}>
        {error ? (
          error
        ) : loading ? (
          'This usually takes 5–15 seconds.'
        ) : (
          <button type="button" onClick={onLoadSample} className="link-btn">
            Load an example profile
          </button>
        )}
      </div>

      {hasResult && (
        <button type="button" onClick={onViewResults} className="link-btn" style={{ marginTop: '0.6rem' }}>
          View last results
        </button>
      )}
    </form>
  );
}

function MatchTab({
  skills,
  setSkills,
  services,
  onServicesChange,
  mode,
  setMode,
  jobPost,
  setJobPost,
  skillCount,
  emailValid,
  hasMatchInput,
  onSubmit,
  loading,
  error,
  onLoadSample,
  hasResult,
  onViewResults,
  hasRewriteOverview,
  onUseOverview,
}) {
  const canSubmit = emailValid && hasMatchInput && !loading;
  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Your skills</h2>
      <p className="sub">Upwork allows up to 20 skills on a profile.</p>

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
        onChange={onServicesChange}
        placeholder="Paste your whole Upwork profile overview here — not just a sentence. The full thing gives much better skill matches."
        rows={8}
      />
      {services.trim().length > 0 && services.trim().length < SHORT_OVERVIEW_THRESHOLD && (
        <div style={{ fontSize: '0.78rem', marginTop: '0.3rem', color: 'var(--weak-ink)' }}>
          This looks short for a full overview — paste your whole summary for better matches.
        </div>
      )}
      {hasRewriteOverview && (
        <button type="button" onClick={onUseOverview} className="link-btn" style={{ marginTop: '0.4rem' }}>
          Use my overview from the Title &amp; Overview tab
        </button>
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
          <textarea id="jobPost" value={jobPost} onChange={(e) => setJobPost(e.target.value)} placeholder="Paste the job post you're applying to..." />
        </>
      )}

      <button className="btn" type="submit" disabled={!canSubmit}>
        {loading ? 'Checking your skills…' : 'Check my skills'}
      </button>

      <div className={`status-line ${error ? 'err' : ''}`}>
        {error ? (
          error
        ) : loading ? (
          'This usually takes 5–15 seconds.'
        ) : (
          <button type="button" onClick={onLoadSample} className="link-btn">
            Load an example
          </button>
        )}
      </div>

      {hasResult && (
        <button type="button" onClick={onViewResults} className="link-btn" style={{ marginTop: '0.6rem' }}>
          View last results
        </button>
      )}
    </form>
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

function ChecklistRow({ item, status, note }) {
  const cls = status === 'pass' ? 'pass' : status === 'flag' ? 'weak' : 'muted';
  const label = status === 'pass' ? 'pass' : status === 'flag' ? 'flag' : "can't tell";
  return (
    <div className="score-row">
      <span className={`pill ${cls}`}>{label}</span>
      <div>
        <div className="label">{item}</div>
        <div className="note">{note}</div>
      </div>
    </div>
  );
}
