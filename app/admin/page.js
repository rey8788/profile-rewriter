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

// Always fetch fresh — this list changes as people use the tools, and it's never
// something we want a browser or CDN caching.
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }) {
  const sp = await searchParams;
  const key = typeof sp?.key === 'string' ? sp.key : '';
  const adminKey = process.env.ADMIN_KEY;
  const authorized = Boolean(adminKey) && key === adminKey;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <nav className="tool-nav">
            <a href="/">Title &amp; Overview</a>
            <a href="/skills">Skills Optimizer</a>
          </nav>
          <p className="eyebrow">Upwork Profile Builder</p>
          <h1>Captured Emails</h1>
          <p>
            A private list of everyone who has used a free check on either tool, and how
            many of their 5 they have left.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.25rem 1.5rem 4rem' }}>
        <div className="card">
          {!authorized ? <NotAuthorized hasAdminKey={Boolean(adminKey)} /> : <SubscriberTable />}
        </div>
      </main>
    </>
  );
}

function NotAuthorized({ hasAdminKey }) {
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

async function SubscriberTable() {
  const subscribers = await getAllSubscribers();

  return (
    <>
      <h2>{subscribers.length} email{subscribers.length === 1 ? '' : 's'} captured</h2>
      <p className="sub" style={{ marginTop: '0.3rem' }}>
        Reload this page any time to see the latest — nothing here is cached.
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
                <th style={thStyle}>Checks left</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((row) => (
                <tr key={row.email}>
                  <td style={tdStyle}>{row.email}</td>
                  <td style={tdStyle}>
                    {row.used} of {FREE_CREDITS}
                  </td>
                  <td style={tdStyle}>
                    <span className={`pill ${row.remaining > 0 ? 'pass' : 'weak'}`}>
                      {row.remaining > 0 ? `${row.remaining} left` : 'out'}
                    </span>
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
