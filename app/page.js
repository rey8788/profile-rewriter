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
    p: "Already on Upwork? Upload a screenshot (or a few) of your profile and we'll check it section by section — photo, rate, skills, portfolio, work history, and more. Brand new to Upwork? Upload your resume instead and we'll draft a starting title, overview, and skills list from your real experience.",
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
  const [scanMode, setScanMode] = useState('existing'); // 'existing' | 'resume'
  const [scanImages, setScanImages] = useState([]); // [{ name, size, dataUrl }]
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // ---- Tab 1b: build from resume (first-time Upwork users) ----
  const [resumeFile, setResumeFile] = useState(null); // { name, size, dataUrl } | null
  const [resumeText, setResumeText] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeResult, setResumeResult] = useState(null);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

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

  // ---- footer: privacy notice popup ----
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

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

  function setOverviewAndPersist(value) {
    setOverview(value);
    try {
      window.localStorage.setItem(OVERVIEW_STORAGE_KEY, value);
    } catch (_) {
      /* localStorage unavailable — carry over silently skipped */
    }
  }

  function handleOverviewChange(e) {
    setOverviewAndPersist(e.target.value);
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
    if (lastAction === 'resume') return handleResumeImport();
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

  // ---- Tab 1b: build from resume ----
  async function handleResumeFileSelected(e) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setResumeError('');
    if (file.type !== 'application/pdf') {
      setResumeError('Upload your resume as a PDF, or paste the text instead.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setResumeError('That PDF is over 5MB — try a smaller file, or paste the text instead.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setResumeFile({ name: file.name, size: file.size, dataUrl });
    } catch (_) {
      setResumeError('Could not read that file. Try again, or paste the text instead.');
    }
  }

  function removeResumeFile() {
    setResumeFile(null);
  }

  function handleResumeTextChange(e) {
    setResumeText(e.target.value);
  }

  async function handleResumeImport(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!emailValid || (!resumeFile && !resumeText.trim()) || resumeLoading) return;
    setLastAction('resume');
    setResumeLoading(true);
    setResumeError('');
    setNoCredits(false);
    try {
      const res = await fetch('/api/resume-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeFile: resumeFile?.dataUrl || '',
          resumeText: resumeFile ? '' : resumeText.trim(),
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
      setResumeResult(data);
      setResumeModalOpen(true);
      if (data.suggestedTitle) setTitle(data.suggestedTitle);
      if (data.suggestedOverview) {
        setOverviewAndPersist(data.suggestedOverview);
        setServices(data.suggestedOverview);
      }
      if (Array.isArray(data.suggestedSkills) && data.suggestedSkills.length > 0) {
        setSkills(data.suggestedSkills.join('\n'));
      }
    } catch (err) {
      setResumeError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setResumeLoading(false);
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
            done={{ scan: Boolean(scanResult) || Boolean(resumeResult), rewrite: Boolean(rewriteResult), match: Boolean(matchResult) }}
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
            scanMode={scanMode}
            onScanModeChange={setScanMode}
            emailValid={emailValid}
            scanImages={scanImages}
            onFilesSelected={handleFilesSelected}
            onRemoveImage={removeScanImage}
            onSubmit={handleScan}
            loading={scanLoading}
            error={scanError}
            hasResult={Boolean(scanResult)}
            onViewResults={() => setScanModalOpen(true)}
            resumeFile={resumeFile}
            onResumeFileSelected={handleResumeFileSelected}
            onRemoveResumeFile={removeResumeFile}
            resumeText={resumeText}
            onResumeTextChange={handleResumeTextChange}
            onResumeSubmit={handleResumeImport}
            resumeLoading={resumeLoading}
            resumeError={resumeError}
            hasResumeResult={Boolean(resumeResult)}
            onViewResumeResults={() => setResumeModalOpen(true)}
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

      {resumeModalOpen && resumeResult && (
        <Modal
          title="Your starting profile is ready"
          subtitle={resumeResult.summary}
          onClose={() => setResumeModalOpen(false)}
          footer={
            <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => { setResumeModalOpen(false); setActiveTab('rewrite'); }}>
              Next: Review my title &amp; overview →
            </button>
          }
        >
          {resumeResult.suggestedTitle && (
            <div className="rewrite-block" style={{ marginTop: 0 }}>
              <h3>
                Suggested title <span className="tag">Draft</span>
              </h3>
              <div className="rewrite-copy">{resumeResult.suggestedTitle}</div>
            </div>
          )}

          {resumeResult.suggestedOverview && (
            <div className="rewrite-block">
              <h3>
                Suggested overview <span className="tag">Draft</span>
              </h3>
              <div className="rewrite-copy">{resumeResult.suggestedOverview}</div>
            </div>
          )}

          {Array.isArray(resumeResult.suggestedSkills) && resumeResult.suggestedSkills.length > 0 && (
            <div className="rewrite-block">
              <h3>Suggested skills</h3>
              <ul className="skill-list">
                {resumeResult.suggestedSkills.map((skill, i) => (
                  <li key={i}>{skill}</li>
                ))}
              </ul>
            </div>
          )}

          {resumeResult.rateSuggestion && resumeResult.rateSuggestion.suggestedRange && (
            <div className="rate-suggestion">
              <div className="rate-suggestion-label">Suggested starting rate</div>
              <div className="rate-suggestion-value">{resumeResult.rateSuggestion.suggestedRange}</div>
              <div className="rate-suggestion-meta">
                {resumeResult.rateSuggestion.category}
                {resumeResult.rateSuggestion.experienceLevel ? ` · ${resumeResult.rateSuggestion.experienceLevel}` : ''}
              </div>
              {resumeResult.rateSuggestion.note && (
                <div className="rate-suggestion-note">{resumeResult.rateSuggestion.note}</div>
              )}
            </div>
          )}

          {Array.isArray(resumeResult.gapsFlagged) && resumeResult.gapsFlagged.length > 0 && (
            <div className="gaps">
              <h3>Worth adding before you publish</h3>
              <ul>
                {resumeResult.gapsFlagged.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="sub" style={{ marginTop: '1.4rem' }}>
            Your title, overview, and skills have already been filled into the next two tabs so you can review and
            edit them there. Nothing goes live until you copy it into Upwork yourself.
          </p>
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
        <div className="disclaimer-strip">
          <p>
            Profile Rewriter is a tool to help you build a stronger profile and apply to jobs more
            smartly and strategically. It doesn&apos;t guarantee interviews, clients, or income, and
            it can get things wrong, so treat every suggestion as a starting draft to review and
            personalize in your own words, not something to publish as-is.
          </p>
          <button type="button" className="link-btn muted" onClick={() => setPrivacyModalOpen(true)}>
            Privacy notice
          </button>
        </div>
      </footer>

      {privacyModalOpen && (
        <Modal title="Privacy notice" onClose={() => setPrivacyModalOpen(false)}>
          <div className="privacy-notice">
            <p>
              This tool asks you to upload things that can contain personal information, your
              resume, screenshots of your Upwork profile, your email address, so here&apos;s a plain
              explanation of what happens with that.
            </p>

            <h3>What gets collected</h3>
            <p>
              Your email address, and whatever you submit to the specific tool you&apos;re using:
              profile screenshots, your resume file or pasted resume text, skills, or a job post
              you paste in.
            </p>

            <h3>What it's used for</h3>
            <p>
              Whatever you upload is sent directly to Anthropic&apos;s Claude AI to generate the
              suggestions you asked for (a profile scan, a rewritten title and overview, a job match,
              or a proposal draft). It&apos;s used for that one request and nothing else, no
              marketing, no selling data, no sharing with other companies.
            </p>

            <h3>What's actually stored</h3>
            <p>
              Only your email address and how many free credits you&apos;ve used are stored, so the
              free-credit system works. Your resume, screenshots, skills, and job post text are not
              saved on our end after your request is processed. Anthropic&apos;s own data-handling
              terms apply to what passes through their API to generate your results.
            </p>

            <h3>Questions or removal requests</h3>
            <p>
              If you want your email removed or have a question about this, reach out through{' '}
              <a href="https://stan.store/reymags" target="_blank" rel="noopener noreferrer">
                my Stan Store
              </a>
              .
            </p>
          </div>
        </Modal>
      )}
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
  scanMode,
  onScanModeChange,
  emailValid,
  scanImages,
  onFilesSelected,
  onRemoveImage,
  onSubmit,
  loading,
  error,
  hasResult,
  onViewResults,
  resumeFile,
  onResumeFileSelected,
  onRemoveResumeFile,
  resumeText,
  onResumeTextChange,
  onResumeSubmit,
  resumeLoading,
  resumeError,
  hasResumeResult,
  onViewResumeResults,
  onSkip,
}) {
  const canSubmit = emailValid && scanImages.length > 0 && !loading;
  const canSubmitResume = emailValid && (Boolean(resumeFile) || resumeText.trim().length > 0) && !resumeLoading;

  return (
    <div className="card">
      <h2>{scanMode === 'resume' ? 'Build a starting profile' : 'Upload your profile screenshot'}</h2>

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem', marginBottom: '0.2rem' }}>
        <button
          type="button"
          onClick={() => onScanModeChange('existing')}
          className="btn"
          style={{
            marginTop: 0,
            background: scanMode === 'existing' ? 'var(--accent)' : 'var(--paper)',
            color: scanMode === 'existing' ? 'var(--accent-ink)' : 'var(--ink)',
            border: scanMode === 'existing' ? 'none' : '1px solid var(--line)',
          }}
        >
          I have an Upwork profile
        </button>
        <button
          type="button"
          onClick={() => onScanModeChange('resume')}
          className="btn"
          style={{
            marginTop: 0,
            background: scanMode === 'resume' ? 'var(--accent)' : 'var(--paper)',
            color: scanMode === 'resume' ? 'var(--accent-ink)' : 'var(--ink)',
            border: scanMode === 'resume' ? 'none' : '1px solid var(--line)',
          }}
        >
          I&apos;m new, build from my resume
        </button>
      </div>

      {scanMode === 'existing' ? (
        <form onSubmit={onSubmit}>
          <p className="sub" style={{ marginTop: '0.9rem' }}>
            A full-page screenshot works best. If your profile is long, split it into 2–3 screenshots and upload them
            together — nothing gets invented for parts we can&apos;t see. Include your work history and completed
            jobs if you can — that&apos;s what unlocks a suggested rate range based on your actual experience.
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
      ) : (
        <form onSubmit={onResumeSubmit}>
          <p className="sub" style={{ marginTop: '0.9rem' }}>
            No Upwork profile yet? Upload your resume and we&apos;ll draft a starting title, overview, and skills
            list from your real experience, no client history or ratings get invented, since you don&apos;t have
            any yet. You&apos;ll review and edit everything before it goes live.
          </p>

          <label htmlFor="resume-upload" className="dropzone">
            <span className="dropzone-title">{resumeFile ? 'Choose a different file' : 'Choose your resume'}</span>
            <span className="dropzone-hint">PDF, up to 5MB</span>
            <input
              id="resume-upload"
              type="file"
              accept="application/pdf"
              onChange={onResumeFileSelected}
              style={{ display: 'none' }}
            />
          </label>

          {resumeFile && (
            <ul className="file-list">
              <li>
                <span className="file-name">{resumeFile.name}</span>
                <span className="file-size">{(resumeFile.size / 1024 / 1024).toFixed(1)}MB</span>
                <button type="button" className="file-remove" onClick={onRemoveResumeFile} aria-label={`Remove ${resumeFile.name}`}>
                  ×
                </button>
              </li>
            </ul>
          )}

          <label htmlFor="resume-text" style={{ marginTop: '1.1rem' }}>
            Or paste your resume text instead <span className="hint">(if you don&apos;t have a PDF handy)</span>
          </label>
          <textarea
            id="resume-text"
            value={resumeText}
            onChange={onResumeTextChange}
            placeholder="Paste your resume text here..."
            disabled={Boolean(resumeFile)}
          />

          <button className="btn" type="submit" disabled={!canSubmitResume}>
            {resumeLoading ? 'Building your starting profile…' : 'Build my starting profile'}
          </button>

          <div className={`status-line ${resumeError ? 'err' : ''}`}>
            {resumeError
              ? resumeError
              : resumeLoading
              ? 'This usually takes 10–20 seconds.'
              : !emailValid
              ? 'Add your email above first.'
              : ' '}
          </div>

          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {hasResumeResult && (
              <button type="button" onClick={onViewResumeResults} className="link-btn">
                View last results
              </button>
            )}
            <button type="button" onClick={onSkip} className="link-btn muted">
              Skip this — go straight to Title &amp; Overview →
            </button>
          </div>
        </form>
      )}
    </div>
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
