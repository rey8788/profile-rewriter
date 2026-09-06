import { isValidEmail, grantUnlimitedAccess, revokeUnlimitedAccess } from '../../../lib/credits';

function htmlPage(title, message, ok) {
  return new Response(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 90px auto; padding: 0 20px; color: #2a2a28; text-align: center; }
  h1 { font-size: 1.35rem; margin-bottom: 0.6rem; }
  p { color: #66655f; line-height: 1.5; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
</body>
</html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function applyAccessChange({ providedKey, email, action }) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || providedKey !== adminKey) {
    return { ok: false, title: 'Not authorized', message: "That key is missing or doesn't match." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, title: 'Invalid email', message: 'No valid email was found for this request.' };
  }

  const result = action === 'revoke' ? await revokeUnlimitedAccess(email) : await grantUnlimitedAccess(email);
  if (!result.ok) {
    return { ok: false, title: 'Something went wrong', message: 'Could not update access right now. Please try again in a moment.' };
  }

  return {
    ok: true,
    title: action === 'revoke' ? 'Access revoked' : 'Access granted',
    message:
      action === 'revoke'
        ? `${email} is back to the normal 5 free checks.`
        : `${email} now has unlimited access to both tools.`,
  };
}

// GET version — this is what a link in an email can call directly, since a browser
// only ever GETs a clickable link. Used by the "Email by Zapier" flow: Zapier emails
// Rey when a new membership comes in, the email contains a link to this URL with the
// key/email/action baked in as query params, and clicking it grants access instantly.
export async function GET(req) {
  const url = new URL(req.url);
  const providedKey = url.searchParams.get('key') || '';
  const email = (url.searchParams.get('email') || '').trim().slice(0, 200);
  const action = url.searchParams.get('action') === 'revoke' ? 'revoke' : 'grant';

  const result = await applyAccessChange({ providedKey, email, action });
  return htmlPage(result.title, result.message, result.ok);
}

// POST version — for a Zapier "Webhooks by Zapier" action (needs a paid Zapier plan)
// or any other automation that can call this with a JSON body instead of query params.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed request body — expected JSON.' }, { status: 400 });
  }

  const providedKey = typeof body?.key === 'string' ? body.key : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const action = body?.action === 'revoke' ? 'revoke' : 'grant';

  const result = await applyAccessChange({ providedKey, email, action });
  if (!result.ok) {
    const status = result.title === 'Not authorized' ? 401 : result.title === 'Invalid email' ? 400 : 502;
    return Response.json({ error: result.title, message: result.message }, { status });
  }

  return Response.json({ ok: true, action, email });
}
