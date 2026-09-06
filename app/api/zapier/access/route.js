import { isValidEmail, grantUnlimitedAccess, revokeUnlimitedAccess } from '../../../lib/credits';

// This is the endpoint a Zapier "Webhooks by Zapier" action calls whenever a Stan
// Store sale/subscription event fires — it does the same thing as pasting an email
// into the /admin page's grant form, just triggered automatically instead of by hand.
// Protected with the same ADMIN_KEY already used for the /admin page, sent in the
// JSON body rather than a URL so it never ends up in a log line as a query string.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed request body — expected JSON.' }, { status: 400 });
  }

  const adminKey = process.env.ADMIN_KEY;
  const providedKey = typeof body?.key === 'string' ? body.key : '';
  if (!adminKey || providedKey !== adminKey) {
    return Response.json({ error: 'not_authorized', message: 'Invalid key.' }, { status: 401 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  if (!isValidEmail(email)) {
    return Response.json({ error: 'invalid_email', message: 'Missing or invalid email in the request body.' }, { status: 400 });
  }

  // Default to "grant" — a new sale/subscription should unlock access. Zapier can
  // send action: "revoke" for a cancellation/refund Zap instead.
  const action = body?.action === 'revoke' ? 'revoke' : 'grant';
  const result = action === 'revoke' ? await revokeUnlimitedAccess(email) : await grantUnlimitedAccess(email);

  if (!result.ok) {
    return Response.json(
      { error: result.reason || 'failed', message: 'Could not update access right now.' },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, action, email });
}
