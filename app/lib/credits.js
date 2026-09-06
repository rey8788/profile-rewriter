import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

// Every email gets this many free checks total, shared across both tools
// (Title & Overview and Skills Optimizer both draw from the same pool).
export const FREE_CREDITS = 5;

// How long a 6-digit verification code is valid for after it's emailed out.
const CODE_TTL_SECONDS = 10 * 60;
// Minimum gap between two "send me a code" requests for the same email, so the
// resend button (or a bot) can't be hammered to spam someone's inbox.
const RESEND_COOLDOWN_SECONDS = 45;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let redisClient = null;
let redisKind = null; // 'rest' (Upstash-style HTTP API) or 'tcp' (standard redis:// connection string)

// Different Redis marketplace integrations on Vercel hand back different shapes of
// credentials depending on which provider you connect: some give a REST API URL +
// token pair (Upstash's own integration), others give a single redis:// / rediss://
// connection string (e.g. Redis Cloud's official integration). We support both so
// this doesn't break if the integration ever changes.
function getRedis() {
  if (redisClient) return { client: redisClient, kind: redisKind };

  const restUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) {
    redisClient = new UpstashRedis({ url: restUrl, token: restToken });
    redisKind = 'rest';
    return { client: redisClient, kind: redisKind };
  }

  const connectionUrl =
    process.env.KV_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;
  if (connectionUrl) {
    redisClient = new IORedis(connectionUrl, {
      // Keep a serverless request from hanging for a long time if the connection
      // is slow or unreachable — fail fast so we can fall back to "allow" below.
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redisClient.on('error', (err) => {
      console.warn('Redis (tcp) connection error:', err?.message || err);
    });
    redisKind = 'tcp';
    return { client: redisClient, kind: redisKind };
  }

  return { client: null, kind: null };
}

// @upstash/redis and ioredis both expose get/incr/sadd/smembers/del with matching
// call shapes, but "set with an expiry" is the one place their APIs diverge —
// this small helper hides that difference everywhere else in this file.
async function setWithExpiry(client, kind, key, value, seconds) {
  if (kind === 'tcp') {
    await client.set(key, value, 'EX', seconds);
  } else {
    await client.set(key, value, { ex: seconds });
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// --- Email delivery (SendGrid) -------------------------------------------------

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw new Error('email_not_configured');
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: 'Profile Rewriter' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('SendGrid send failed:', res.status, body);
    throw new Error('email_send_failed');
  }
}

// --- Email verification ---------------------------------------------------------
// Before an email gets any free checks at all, it has to prove it can receive mail:
// we email it a 6-digit code and it has to be typed back in. This is the step that
// stops someone from typing in a made-up or someone-else's email just to get 5 free
// checks — a plain format check alone can't catch that.

export async function isEmailVerified(email) {
  const { client } = getRedis();
  if (!client) return true; // fail open — a missing store should never lock the app up
  try {
    const value = await client.get(`verified:${normalizeEmail(email)}`);
    return Boolean(value);
  } catch (err) {
    console.warn('Verification check failed — allowing through:', err?.message || err);
    return true;
  }
}

// Sends a fresh 6-digit code, unless one was already sent very recently for this email.
export async function sendVerificationCode(email) {
  const { client, kind } = getRedis();
  const normalized = normalizeEmail(email);
  const code = generateCode();

  if (client) {
    try {
      const cooldownKey = `verify_cooldown:${normalized}`;
      const onCooldown = await client.get(cooldownKey);
      if (onCooldown) {
        return { sent: false, reason: 'cooldown' };
      }
      await setWithExpiry(client, kind, `verify_code:${normalized}`, code, CODE_TTL_SECONDS);
      await setWithExpiry(client, kind, cooldownKey, '1', RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      console.warn('Could not store verification code:', err?.message || err);
      return { sent: false, reason: 'store_error' };
    }
  }

  try {
    await sendEmail({
      to: normalized,
      subject: 'Your Profile Rewriter verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error('Failed to send verification email:', err?.message || err);
    return { sent: false, reason: 'email_send_failed' };
  }

  return { sent: true };
}

// Checks a submitted code against what was emailed out. On success, marks the email
// as verified permanently (no expiry) so it never needs to re-verify again.
export async function checkVerificationCode(email, code) {
  const { client } = getRedis();
  if (!client) return { valid: false, reason: 'store_unavailable' };
  const normalized = normalizeEmail(email);
  const submitted = String(code || '').trim();
  try {
    const stored = await client.get(`verify_code:${normalized}`);
    if (!stored) return { valid: false, reason: 'expired' };
    if (String(stored) !== submitted) return { valid: false, reason: 'mismatch' };
    await client.set(`verified:${normalized}`, '1');
    await client.del(`verify_code:${normalized}`);
    return { valid: true };
  } catch (err) {
    console.warn('Verification code check failed:', err?.message || err);
    return { valid: false, reason: 'error' };
  }
}

// --- Paid / unlimited access ------------------------------------------------------
// There's no in-app checkout yet — subscriptions are sold through Stan Store, and
// Rey grants access by hand from the private /admin page once he sees a sale come
// through. Once an email is marked paid here, it skips the 5-check cap entirely.

export async function isPaidSubscriber(email) {
  const { client } = getRedis();
  if (!client) return false;
  try {
    const value = await client.get(`paid:${normalizeEmail(email)}`);
    return Boolean(value);
  } catch (err) {
    console.warn('Paid-status check failed — treating as not paid:', err?.message || err);
    return false;
  }
}

export async function grantUnlimitedAccess(email) {
  const { client } = getRedis();
  if (!client) return { ok: false, reason: 'store_unavailable' };
  const normalized = normalizeEmail(email);
  try {
    await client.set(`paid:${normalized}`, '1');
    try {
      await client.sadd('subscriber_emails', normalized);
    } catch (_) {
      /* non-critical — never fail the grant over the lead list */
    }
    return { ok: true };
  } catch (err) {
    console.warn('Failed to grant unlimited access:', err?.message || err);
    return { ok: false, reason: 'store_error' };
  }
}

// Tells the actual subscriber (not Rey) that their access just unlocked. This is
// best-effort and never throws — a failed notification email should never break
// the grant itself, since the grant already succeeded in Redis by the time this
// is called.
export async function sendAccessGrantedEmail(email) {
  const normalized = normalizeEmail(email);
  try {
    await sendEmail({
      to: normalized,
      subject: 'Your Profile Rewriter access is now unlimited',
      text: `Good news — your Profile Rewriter access is now unlimited. No more 5-check limit on either tool.\n\nRun a check any time: https://profile-rewriter.vercel.app`,
      html: `<p>Good news — your Profile Rewriter access is now <strong>unlimited</strong>. No more 5-check limit on either tool.</p><p>Run a check any time: <a href="https://profile-rewriter.vercel.app">https://profile-rewriter.vercel.app</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.warn('Could not send access-granted email:', err?.message || err);
    return { sent: false };
  }
}

export async function revokeUnlimitedAccess(email) {
  const { client } = getRedis();
  if (!client) return { ok: false, reason: 'store_unavailable' };
  const normalized = normalizeEmail(email);
  try {
    await client.del(`paid:${normalized}`);
    return { ok: true };
  } catch (err) {
    console.warn('Failed to revoke unlimited access:', err?.message || err);
    return { ok: false, reason: 'store_error' };
  }
}

// --- Free-check credits -----------------------------------------------------------

// Read-only: how many free checks does this email have left, without spending one.
// If the credit store isn't configured yet, OR the store errors out for any reason,
// this fails OPEN (allows the request) rather than blocking the tool entirely — a
// database hiccup should never take the whole app down, it just means that one
// request goes untracked. An unverified email is blocked here too, before we even
// look at its credit balance.
export async function getCreditStatus(email) {
  const verified = await isEmailVerified(email);
  if (!verified) {
    return { allowed: false, remaining: FREE_CREDITS, tracked: false, reason: 'not_verified' };
  }

  const paid = await isPaidSubscriber(email);
  if (paid) {
    return { allowed: true, remaining: null, tracked: true, unlimited: true };
  }

  const { client } = getRedis();
  if (!client) {
    console.warn('Credit store not configured (no KV/Upstash/Redis env vars found) — allowing request untracked.');
    return { allowed: true, remaining: FREE_CREDITS, tracked: false };
  }
  const normalized = normalizeEmail(email);
  try {
    const raw = await client.get(`credits:${normalized}`);
    const used = Number(raw || 0);
    const remaining = Math.max(0, FREE_CREDITS - used);
    return { allowed: remaining > 0, remaining, tracked: true, reason: remaining > 0 ? null : 'no_credits' };
  } catch (err) {
    console.warn('Credit store read failed — allowing request untracked:', err?.message || err);
    return { allowed: true, remaining: FREE_CREDITS, tracked: false };
  }
}

// Every email that's ever used a free check, plus how many of their 5 they've used —
// powers the private /admin page so Rey can see his lead list without needing to
// touch the Redis provider's own dashboard at all.
export async function getAllSubscribers() {
  const { client } = getRedis();
  if (!client) return [];
  try {
    const emails = await client.smembers('subscriber_emails');
    const rows = await Promise.all(
      emails.map(async (email) => {
        const [usedRaw, paidRaw] = await Promise.all([
          client.get(`credits:${email}`),
          client.get(`paid:${email}`),
        ]);
        const used = Number(usedRaw || 0);
        return { email, used, remaining: Math.max(0, FREE_CREDITS - used), paid: Boolean(paidRaw) };
      })
    );
    rows.sort((a, b) => a.email.localeCompare(b.email));
    return rows;
  } catch (err) {
    console.warn('Failed to load subscriber list:', err?.message || err);
    return [];
  }
}

// Call this only after a check has actually succeeded and is about to be returned —
// never charge a credit for a request that errored out. Paid emails skip the counter
// entirely — they're never charged down and never run out.
export async function consumeCredit(email) {
  const { client } = getRedis();
  if (!client) return { remaining: FREE_CREDITS, tracked: false };
  const normalized = normalizeEmail(email);
  try {
    const paid = await isPaidSubscriber(email);
    if (paid) {
      try {
        await client.sadd('subscriber_emails', normalized);
      } catch (_) {
        /* non-critical — never fail the response over the lead list */
      }
      return { remaining: null, tracked: true, unlimited: true };
    }
    const used = await client.incr(`credits:${normalized}`);
    try {
      // Keep a simple running list of every email that's used the tool, for Rey's
      // own follow-up — visible via the private /admin page.
      await client.sadd('subscriber_emails', normalized);
    } catch (_) {
      /* non-critical — never fail the response over the lead list */
    }
    return { remaining: Math.max(0, FREE_CREDITS - used), tracked: true };
  } catch (err) {
    console.warn('Credit store write failed — not counted this time:', err?.message || err);
    return { remaining: FREE_CREDITS, tracked: false };
  }
}
