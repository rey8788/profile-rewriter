import { getAllSubscribers, FREE_CREDITS } from '../lib/credits';

const thStyle = {
  textAlign: 'left',
  padding: '0.6rem 0.7rem',
  borderBottom: '1px solid var(--line)',
  color: 'var(--ink-muted)',
  fontWeight: 600,
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
const tdStyle = {
  textAlign: 'left',
  padding: '0.6rem 0.7rem',
  borderBottom: '1px solid var(--line)',
  color: 'var(--ink)',
};

const ERROR_MESSAGES = {
  not_authorized: "That admin key didn't match — the page reloaded before the change could be made.",
  invalid_email: 'Enter a valid email address to grant or revoke access.',
  store_unavailable: 'The credit store isn’t configured right now, so this couldn’t be saved.',
  store_error: 'Something went wrong saving that — please try again.',
  failed: 'Something went wrong saving that — please try again.',
};

const DONE_MESSAGES = {
  grant: 'Unlimited access granted.',
  revoke: 'Unlimited access revoked — back to the normal 5 free checks.',
};

// Always fetch fresh — this list changes as people use the tools, and it's never
// something we want a browser or CDN caching.
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }) {
  const sp = await searchParams;
  const key = typeof sp?.key === 'string' ? sp.key : '';
  const adminKey = process.env.ADMIN_KEY;
  const authorized = Boolean(adminKey) && key === adminKey;
  const errorCode = typeof sp?.error === 'string' ? sp.error : '';
  const doneAction = typeof sp?.done === 'string' ? sp.done : '';

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <nav className="tool-nav">
            <a href="/">Title &amp; Overview</a>
            <a href="/skills">Job Match</a>
          </nav>
          <p className="eyebrow">Upwork Profile Builder</p>
          <h1>Captured Emails</h1>
          <p>
            A private list of everyone who has used a free check on either tool, how many of
            their 5 they have left, and a way to grant unlimited access to paying subscribers.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.25rem 1.5rem 4rem' }}>
        <div className="card">
          {authorized ? (
            <AdminPanel adminKey={adminKey} errorCode={errorCode} doneAction={doneAction} />
          ) : (
            <Locked hasAdminKey={Boolean(adminKey)} />
          )}
        </div>
      </main>
    </>
  );
}

function Locked({ hasAdminKey }) {
  if (!hasAdminKey) {
    return (
      <>
        <h2>Set up your private key first</h2>
        <p className="sub" style={{ marginTop: '0.6rem' }}>
          This page isn&apos;t locked to anyone yet because no admin key has been set. In your
          Vercel project, go to Settings → Environment Variables and add a new variable named{' '}
          <code>ADMIN_KEY</code> with any private value you pick (think of it like a password —
          for example a random string of letters and numbers). Redeploy, then come back to this
          page at:
        </p>
        <div className="rewrite-copy" style={{ marginTop: '0.8rem' }}>
          https://profile-rewriter.vercel.app/admin?key=YOUR_ADMIN_KEY
        </div>
        <p className="sub" style={{ marginTop: '0.8rem' }}>
          Bookmark that link once it works — that&apos;s how you&apos;ll check this list from now on.
        </p>
      </>
    );
  }
  return (
    <>
      <h2>Not authorized</h2>
      <p className="sub" style={{ marginTop: '0.6rem' }}>
        Add <code>?key=YOUR_ADMIN_KEY</code> to the end of this page&apos;s URL, using the value
        you set for <code>ADMIN_KEY</code> in Vercel.
      </p>
    </>
  );
}

async function AdminPanel({ adminKey, errorCode, doneAction }) {
  const subscribers = await getAllSubscribers();
  const redirect = `/admin?key=${adminKey}`;

  return (
    <>
      <h2>
        {subscribers.length} email{subscribers.length === 1 ? '' : 's'} captured
      </h2>
      <p className="sub" style={{ marginTop: '0.3rem' }}>
        Reload this page any time to see the latest — nothing here is cached.
      </p>

      {errorCode && (
        <div className="gaps" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>{ERROR_MESSAGES[errorCode] || 'Something went wrong. Please try again.'}</p>
        </div>
      )}
      {!errorCode && doneAction && (
        <div className="gaps" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>{DONE_MESSAGES[doneAction] || 'Saved.'}</p>
        </div>
      )}

      <form
        action="/api/admin/access"
        method="POST"
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '1.2rem',
          padding: '1rem',
          border: '1px solid var(--line)',
          borderRadius: 8,
        }}
      >
        <input type="hidden" name="key" value={adminKey} />
        <input type="hidden" name="redirect" value={redirect} />
        <input
          type="email"
          name="email"
          placeholder="customer@email.com"
          required
          style={{
            padding: '0.55rem 0.7rem',
            border: '1px solid var(--line)',
            borderRadius: 6,
            minWidth: 240,
            flex: '1 1 240px',
            font: 'inherit',
          }}
        />
        <button type="submit" name="action" value="grant" className="btn" style={{ marginTop: 0 }}>
          Grant unlimited
        </button>
        <button
          type="submit"
          name="action"
          value="revoke"
          className="btn"
          style={{ marginTop: 0, background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }}
        >
          Revoke
        </button>
      </form>
      <p className="sub" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
        Use this once someone subscribes through Stan Store — paste their email and grant unlimited access. Revoke it the same way if a subscription ends.
      </p>

      {subscribers.length === 0 ? (
        <p className="sub" style={{ marginTop: '1.2rem' }}>
          No one has used a free check yet. Once someone does, they&apos;ll show up here.
        </p>
      ) : (
        <div style={{ marginTop: '1.2rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Checks used</th>
                <th style={thStyle}>Access</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.email}>
                  <td style={tdStyle}>{s.email}</td>
                  <td style={tdStyle}>{s.paid ? '—' : `${s.used} of ${FREE_CREDITS}`}</td>
                  <td style={tdStyle}>
                    {s.paid ? (
                      <span className="pill pass">Unlimited</span>
                    ) : (
                      <span className={`pill ${s.remaining > 0 ? 'pass' : 'weak'}`}>
                        {s.remaining > 0 ? `${s.remaining} left` : 'out'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
