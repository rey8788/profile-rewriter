import { isValidEmail, sendVerificationCode } from '../../lib/credits';

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

  const result = await sendVerificationCode(email);

  if (!result.sent) {
    if (result.reason === 'cooldown') {
      return Response.json(
        {
          error: 'cooldown',
          message: 'A code was already sent recently — check your inbox (and spam folder), or wait a bit before requesting another.',
        },
        { status: 429 }
      );
    }
    return Response.json(
      { error: 'send_failed', message: 'Could not send a verification email right now. Please try again in a moment.' },
      { status: 502 }
    );
  }

  return Response.json({ sent: true });
}
