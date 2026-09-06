import { isValidEmail, checkVerificationCode } from '../../lib/credits';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed request body.' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const code = typeof body?.code === 'string' ? body.code.trim().slice(0, 20) : '';

  if (!isValidEmail(email)) {
    return Response.json({ error: 'invalid_email', message: 'Enter a valid email first.' }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: 'invalid_code', message: 'Enter the code we emailed you.' }, { status: 400 });
  }

  const result = await checkVerificationCode(email, code);

  if (!result.valid) {
    const message =
      result.reason === 'expired'
        ? 'That code has expired. Request a new one and try again.'
        : result.reason === 'mismatch'
        ? "That code doesn't match. Double check and try again."
        : 'Could not verify that code right now. Please try again.';
    return Response.json({ error: result.reason || 'invalid_code', message }, { status: 400 });
  }

  return Response.json({ verified: true });
}
