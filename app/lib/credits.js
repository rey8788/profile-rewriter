import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

// Every email gets this many free checks total, shared across both tools
// (Title & Overview and Skills Optimizer both draw from the same pool).
export const FREE_CREDITS = 5;

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

// Read-only: how many free checks does this email have left, without spending one.
// If the credit store isn't configured yet, OR the store errors out for any reason,
// this fails OPEN (allows the request) rather than blocking the tool entirely — a
// database hiccup should never take the whole app down, it just means that one
// request goes untracked.
export async function getCreditStatus(email) {
  const { client, kind } = getRedis();
  if (!client) {
    console.warn('Credit store not configured (no KV/Upstash/Redis env vars found) — allowing request untracked.');
    return { allowed: true, remaining: FREE_CREDITS, tracked: false };
  }
  const normalized = normalizeEmail(email);
  try {
    const raw = kind === 'tcp' ? await client.get(`credits:${normalized}`) : await client.get(`credits:${normalized}`);
    const used = Number(raw || 0);
    const remaining = Math.max(0, FREE_CREDITS - used);
    return { allowed: remaining > 0, remaining, tracked: true };
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
        const used = Number((await client.get(`credits:${email}`)) || 0);
        return { email, used, remaining: Math.max(0, FREE_CREDITS - used) };
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
// never charge a credit for a request that errored out.
export async function consumeCredit(email) {
  const { client } = getRedis();
  if (!client) return { remaining: FREE_CREDITS, tracked: false };
  const normalized = normalizeEmail(email);
  try {
    const used = await client.incr(`credits:${normalized}`);
    try {
      // Keep a simple running list of every email that's used the tool, for Rey's
      // own follow-up — visible in the Redis/Upstash data browser as a Redis set.
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
