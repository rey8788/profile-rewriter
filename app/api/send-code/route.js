import { isValidEmail, isDisposableEmail, checkSignupRateLimit, sendVerificationCode } from '../../lib/credits';

function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || '';
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed request body.' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  if (!isValidEmail(email)) {
    return Response.json({ error: 'invalid_email', message: 'Enter a valid email first.' }, { status: 400 });
  }

  if (isDisposableEmail(email)) {
    return Response.json({ error: 'disposable_email', message: 'Please use a real, regular email address — temporary or throwaway inboxes aren’t supported.' }, { status: 400 });
  }

  const rate = await checkSignupRateLimit(getClientIp(req));
  if (!rate.allowed) {
    return Response.json({ error: 'rate_limited', message: 'Too many new emails from this network today. Please try again tomorrow, or subscribe for unlimited access.' }, { status: 429 });
  }

  const result = await sendVerificationCode(email);
  if (!result.sent) {
    if (result.reason === 'cooldown') {
      return Response.json({ error: 'cooldown', message: 'A code was already sent recently — check your inbox (and spam folder), or wait a bit before requesting another.' }, { status: 429 });
    }
    return Response.json({ error: 'send_failed', message: 'Could not send a verification email right now. Please try again in a moment.' }, { status: 502 });
  }
  return Response.json({ sent: true });
}
