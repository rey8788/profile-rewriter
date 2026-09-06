import { Redis } from '@upstash/redis';

// Every email gets this many free checks total, shared across both tools
// (Title & Overview and Skills Optimizer both draw from the same pool).
export const FREE_CREDITS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  // Support either naming convention Vercel/Upstash may inject depending on
  // how the storage integration was added.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

// Read-only: how many free checks does this email have left, without spending one.
// If the credit store isn't configured yet, this fails OPEN (allows the request)
// rather than blocking the tool entirely — that way a missing env var never takes
// the whole app down, it just means usage isn't being tracked yet.
export async function getCreditStatus(email) {
  const client = getRedis();
  if (!client) {
    console.warn('Credit store not configured (missing KV/Upstash env vars) — allowing request untracked.');
    return { allowed: true, remaining: FREE_CREDITS, tracked: false };
  }
  const normalized = normalizeEmail(email);
  const used = Number((await client.get(`credits:${normalized}`)) || 0);
  const remaining = Math.max(0, FREE_CREDITS - used);
  return { allowed: remaining > 0, remaining, tracked: true };
}

// Call this only after a check has actually succeeded and is about to be returned —
// never charge a credit for a request that errored out.
export async function consumeCredit(email) {
  const client = getRedis();
  if (!client) return { remaining: FREE_CREDITS, tracked: false };
  const normalized = normalizeEmail(email);
  const used = await client.incr(`credits:${normalized}`);
  try {
    // Keep a simple running list of every email that's used the tool, for Rey's
    // own follow-up — visible in the Vercel/Upstash data browser as a Redis set.
    await client.sadd('subscriber_emails', normalized);
  } catch (_) {
    /* non-critical — never fail the response over the lead list */
  }
  return { remaining: Math.max(0, FREE_CREDITS - used), tracked: true };
}
