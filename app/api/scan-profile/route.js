import Anthropic from '@anthropic-ai/sdk';
import { getCreditStatus, consumeCredit, isValidEmail } from '../../lib/credits';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGES = 4;
const MAX_BASE64_CHARS_PER_IMAGE = 7_000_000; // ~5MB raw, base64 runs about 4/3 bigger

// General-market reference ranges, not Upwork-sourced data — used only to keep the
// model's rate suggestions grounded in a realistic anchor instead of guessing freely.
// Upwork is a global marketplace so real rates skew below US W2-style averages,
// especially at entry level, which is already reflected in these ranges.
const RATE_REFERENCE = `Reference hourly-rate ranges by category and experience level (broad market anchors, not exact figures — a specific profile can reasonably land outside these, especially for a niche specialty):
- Data entry / admin support: Entry $6-12, Intermediate $12-18, Expert $18-25
- Customer service / virtual assistant: Entry $8-15, Intermediate $15-25, Expert $25-40+
- Social media management: Entry $12-20, Intermediate $20-35, Expert $35-60+
- Bookkeeping / accounting support: Entry $15-20, Intermediate $20-35, Expert $35-60+
- Content writing / copywriting: Entry $15-25, Intermediate $25-45, Expert $45-80+
- Graphic design: Entry $15-25, Intermediate $25-45, Expert $45-85+
- Video editing: Entry $15-25, Intermediate $25-45, Expert $45-85+
- SEO: Entry $15-25, Intermediate $25-50, Expert $50-90+
- Project management: Entry $18-28, Intermediate $28-50, Expert $50-90+
- Web / software development: Entry $20-35, Intermediate $35-60, Expert $60-120+`;

function buildScanPrompt() {
  return `You are checking screenshots of an Upwork freelancer profile page for completeness, not writing quality. Upwork's own "Profile Completeness" meter should already say 100% before this matters much, so treat this as a second pair of eyes, not a contradiction of that meter.

Look only at what is actually visible in the image(s) I'm giving you. Never assume or invent that something exists if you can't see it, and never assume something is missing just because it isn't in the part of the page shown. If a section's presence can't be confirmed from the screenshot(s), mark it "not_visible" rather than guessing.

Check for these sections, in this order:
1. Profile photo — a real photo, not a placeholder or default avatar icon
2. Title — the headline under the name
3. Overview / summary text — the "About" or summary block
4. Hourly rate — a rate is shown and set
5. Skills — a list of skill tags
6. Portfolio / work samples / project catalog
7. Work history — completed jobs, reviews, or ratings shown
8. Employment history / experience section
9. Certifications — only mark this "flag" if the layout clearly shows an empty certifications section with a prompt to add one; many real profiles legitimately have none, so an absent section on its own is "not_visible", not a flag
10. Video introduction — nice to have, not required; if it's missing just note that, never mark it "flag"
11. Languages listed
12. Availability badge / hours-per-week setting

For each, decide "pass" (clearly present and filled in), "flag" (visibly present as a section but empty, incomplete, or showing a placeholder/prompt to add info), or "not_visible" (this part of the page isn't shown in the screenshot(s) provided, so it can't be checked here).

Then write a short plain-English summary (1-2 sentences, like you're telling a friend) and a flaggedItems list naming only the genuine "flag" items in plain language. Leave flaggedItems empty if everything checkable looks complete.

RATE SUGGESTION
Separate from the completeness check above: figure out, using only what's actually visible in the screenshot(s), both (a) which ONE category from the reference list below this profile fits, and (b) roughly what experience level (entry, intermediate, or expert) the freelancer's real work history supports. Do not force either one. If either can't be honestly determined from what's shown, leave rateSuggestion entirely null rather than guessing.

To judge experience level, weigh actual evidence of work history and skill depth, not job titles or self-description: total jobs completed and total hours worked if shown, Job Success Score and client reviews/ratings if shown, the depth and breadth of the portfolio or work samples, how much relevant employment history is listed, and how specialized vs. broad the listed skills are. A profile showing many completed jobs, strong ratings, and a specialized skill set reads as expert even if the person never says so. A profile with little to no work history visible, few or generic skills, and no completed jobs shown reads as entry. Most real profiles fall in between, read as intermediate unless the evidence clearly points higher or lower. If the screenshot(s) don't show enough of this (e.g. only the top of the profile with no work history section visible), don't guess, that's a case for leaving rateSuggestion null.

${RATE_REFERENCE}

If a category is clearly identifiable AND you can honestly estimate an experience level from real evidence, suggest a realistic hourly rate range using the matching reference row as your anchor point, adjusted slightly only if something specific and visible (a clear specialty, an unusually strong portfolio, unusually high or low Job Success Score) genuinely supports going a bit outside it, never invented. If the screenshot(s) also show a rate the freelancer has actually set, compare it to your suggested range and say so plainly in the note (e.g. it looks low for their level, it looks reasonable, it looks high but could be justified by X visible in the profile) without being preachy about it, just a factual heads up they can act on or ignore. In the note, briefly name the actual signal you used (e.g. "based on your 40+ completed jobs and 98% Job Success Score" or "based on the skills and portfolio shown, since work history wasn't visible in these screenshots") so it's clear this wasn't a guess.

If either the category or the experience level can't be honestly determined from what's visible, set rateSuggestion to null. Never invent a category, an experience level, or a number that isn't grounded in what's actually visible plus the reference ranges above.

Never use an em dash (—) anywhere in the summary or notes. Use a period, a comma, or a simple word like "and" or "but" instead.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "summary": "1-2 sentence plain-language summary",
  "sections": [
    {"item": "Profile photo", "status": "pass, flag, or not_visible", "note": "one short sentence"},
    {"item": "Title", "status": "...", "note": "..."},
    {"item": "Overview / summary", "status": "...", "note": "..."},
    {"item": "Hourly rate", "status": "...", "note": "..."},
    {"item": "Skills", "status": "...", "note": "..."},
    {"item": "Portfolio / work samples", "status": "...", "note": "..."},
    {"item": "Work history", "status": "...", "note": "..."},
    {"item": "Employment history", "status": "...", "note": "..."},
    {"item": "Certifications", "status": "...", "note": "..."},
    {"item": "Video introduction", "status": "...", "note": "..."},
    {"item": "Languages", "status": "...", "note": "..."},
    {"item": "Availability / badges", "status": "...", "note": "..."}
  ],
  "flaggedItems": ["short phrases naming genuinely incomplete sections"],
  "rateSuggestion": {
    "category": "the matched category name, or null if none was identifiable",
    "experienceLevel": "entry, intermediate, or expert, based on the real work-history evidence you found, or null if it couldn't be honestly estimated",
    "suggestedRange": "e.g. $18-$28/hr, or null",
    "note": "one short sentence naming the actual signal used (jobs completed, Job Success Score, portfolio, skills) and explaining the suggestion, or comparing it to their current rate if one is visible, or null"
  }
}
If rateSuggestion cannot be honestly filled in (no clear category, or not enough visible evidence to estimate experience level), set the whole rateSuggestion value to null rather than filling its fields with guesses.`;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch (_) {
        /* fall through */
      }
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        /* fall through */
      }
    }
    return null;
  }
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!match) return null;
  const [, mediaType, data] = match;
  if (!ALLOWED_TYPES.includes(mediaType)) return null;
  if (data.length > MAX_BASE64_CHARS_PER_IMAGE) return null;
  return { mediaType, data };
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'server_misconfigured', message: 'ANTHROPIC_API_KEY is not set on the server.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: 'invalid_request', message: 'Malformed request body.' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const rawImages = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES + 1) : [];

  if (!isValidEmail(email)) {
    return Response.json(
      { error: 'invalid_email', message: 'Enter a valid email to run this check.' },
      { status: 400 }
    );
  }

  if (rawImages.length === 0) {
    return Response.json(
      { error: 'invalid_request', message: 'Upload at least one screenshot of your profile page.' },
      { status: 400 }
    );
  }
  if (rawImages.length > MAX_IMAGES) {
    return Response.json(
      { error: 'invalid_request', message: `Upload up to ${MAX_IMAGES} screenshots at a time.` },
      { status: 400 }
    );
  }

  const parsedImages = [];
  for (const raw of rawImages) {
    const parsed = parseDataUrl(raw);
    if (!parsed) {
      return Response.json(
        {
          error: 'invalid_image',
          message: 'One of those screenshots could not be read — use a PNG, JPG, WEBP, or GIF under 5MB.',
        },
        { status: 400 }
      );
    }
    parsedImages.push(parsed);
  }

  const creditStatus = await getCreditStatus(email);
  if (!creditStatus.allowed) {
    if (creditStatus.reason === 'not_verified') {
      return Response.json(
        {
          error: 'email_not_verified',
          message: 'Verify your email first — we just sent a 6-digit code to it.',
        },
        { status: 403 }
      );
    }
    return Response.json(
      {
        error: 'no_credits',
        message: `You've used all ${creditStatus.total} free credits, shared across every tool (profile scan, title & overview, job match, and proposal writer). Subscribe to Profile Rewriter Unlimited for unlimited access.`,
        remaining: 0,
        total: creditStatus.total,
        subscribeUrl: 'https://stan.store/reymags/p/profile-rewriter--unlimited-access',
      },
      { status: 403 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const content = [
      ...parsedImages.map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.data },
      })),
      { type: 'text', text: buildScanPrompt() },
    ];

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const rawText = textBlock ? textBlock.text : '';
    const data = extractJson(rawText);

    if (!data) {
      return Response.json(
        { error: 'invalid_json', message: 'Could not parse a response. Please try again.' },
        { status: 502 }
      );
    }

    const { remaining, total, unlimited } = await consumeCredit(email);
    return Response.json({ ...data, creditsRemaining: remaining, creditsTotal: total, unlimitedAccess: Boolean(unlimited) });
  } catch (err) {
    console.error('scan-profile route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
