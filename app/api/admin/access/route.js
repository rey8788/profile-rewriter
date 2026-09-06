import { isValidEmail, grantUnlimitedAccess, revokeUnlimitedAccess } from '../../../lib/credits';

// Plain HTML form submits to this route (no client-side JS needed) — the /admin
// page posts here with the admin key, the target email, and which button was
// pressed ("grant" or "revoke"), then this redirects straight back to /admin so
// the table reloads with the change already reflected.
export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed form submission.' }, { status: 400 });
  }

  const adminKey = process.env.ADMIN_KEY;
  const providedKey = String(form.get('key') || '');
  const redirectTo = String(form.get('redirect') || '/admin');

  if (!adminKey || providedKey !== adminKey) {
    return Response.redirect(new URL(`${redirectTo}&error=not_authorized`, req.url), 303);
  }

  const email = String(form.get('email') || '').trim().slice(0, 200);
  if (!isValidEmail(email)) {
    return Response.redirect(new URL(`${redirectTo}&error=invalid_email`, req.url), 303);
  }

  const action = form.get('action') === 'revoke' ? 'revoke' : 'grant';
  const result = action === 'revoke' ? await revokeUnlimitedAccess(email) : await grantUnlimitedAccess(email);

  if (!result.ok) {
    return Response.redirect(new URL(`${redirectTo}&error=${result.reason || 'failed'}`, req.url), 303);
  }

  return Response.redirect(new URL(`${redirectTo}&done=${action}`, req.url), 303);
}
