import Anthropic from '@anthropic-ai/sdk';
import { getCreditStatus, consumeCredit, isValidEmail } from '../../lib/credits';

const MAX_RESUME_BASE64_CHARS = 7_000_000; // ~5MB raw, base64 runs about 4/3 bigger
const MAX_RESUME_TEXT_CHARS = 12_000;

// Same reference table used by the Profile Scan rate suggestion, kept in sync by hand
// since each API route in this app is self-contained. Update both if these change.
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

function buildResumePrompt(resumeText) {
  return `You are helping someone who is new to Upwork build a first-draft profile from their resume. ${
    resumeText
      ? 'Their resume text is included below.'
      : 'Their resume is attached as a PDF document.'
  } They have no Upwork history yet: no completed jobs, no clients, no ratings. Your job is to translate their real, existing work experience into an honest first-draft Upwork title, overview, and skills list, never to invent freelance history they don't have.

${resumeText ? `THEIR RESUME TEXT:\n${resumeText}\n` : ''}
Use only what's actually in the resume: real employers, job titles, dates, responsibilities, tools and software named, measurable results, education, and certifications. Never invent Upwork jobs, clients, ratings, testimonials, completed-jobs counts, or any freelance experience that isn't there. If the resume is too thin, generic, or hard to read to responsibly build a piece, leave that piece null rather than guessing.

SUGGESTED TITLE
Write a real Upwork-style headline, similar in shape to "Customer Support & Ops Specialist | Zendesk Setup | E-Commerce": a role plus a specialty plus a key tool or focus area, all grounded in what the resume actually shows. Keep it to 70 characters or fewer. If there isn't enough in the resume to support a specific, honest title, set suggestedTitle to null.

SUGGESTED OVERVIEW
Write it in first person, following this structure, same as the Profile Builder framework used elsewhere in this app:
1. Hook: what kind of work they want to do and the value they bring, grounded in their real background.
2. What I do: a plain description of their actual capabilities, based on their real job history.
3. How I help: how they'd approach client work, translated from their real day-to-day responsibilities.
4. Proof: their strongest verifiable achievement from the resume, a real number, outcome, or scope of responsibility. It is fine and expected for this to come from a traditional job, not freelance work.
Never state or imply they have done freelance work, served any Upwork clients, or have ratings or reviews, since they don't yet. If the resume doesn't give enough to responsibly write this, set suggestedOverview to null.

SUGGESTED SKILLS
List only tools, software, and named competencies that actually appear in the resume, not things you're inferring purely from a job title. Order them with whatever's most relevant to their likely freelance category first. Up to 20. Use an empty array if nothing concrete can be pulled out.

RATE SUGGESTION
Using the same idea as reading a completed Upwork profile, but here you're reading a resume: figure out which ONE category from the reference list below fits, and estimate an experience level (entry, intermediate, or expert) from real evidence, actual years of experience, seniority of job titles, and scope of responsibility described, not self-description or job titles alone. Most people with a handful of years in a relevant role read as intermediate unless the evidence clearly points higher or lower. If either the category or the experience level can't be honestly determined from the resume, set rateSuggestion to null entirely.

${RATE_REFERENCE}

If you can honestly identify both a category and an experience level, suggest a realistic hourly rate range anchored to the matching reference row, adjusted only if something specific and verifiable in the resume (a notable specialty, an unusually senior scope) genuinely supports it. In the note, briefly name the real evidence you used (e.g. "based on 5 years as a Marketing Coordinator with hands-on Shopify and Klaviyo experience"). Never invent a category, level, or number not grounded in the resume plus the reference ranges above.

GAPS
List real, practical things worth addressing before this profile goes live: no portfolio or work samples yet, no certifications relevant to the target category, the resume doesn't show measurable results, and similar. These are honest prompts for the person to consider, not things to fabricate on their behalf.

Never use an em dash (—) anywhere in your reply. Use a period, a comma, or a simple word like "and" or "but" instead.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "summary": "1-2 sentence plain-language summary of what was drafted and how much the resume gave you to work with",
  "suggestedTitle": "a headline of 70 characters or fewer, or null",
  "suggestedOverview": "the full overview text following Hook / What I do / How I help / Proof, or null",
  "suggestedSkills": ["only real skills pulled from the resume"],
  "rateSuggestion": {
    "category": "the matched category name, or null if none was identifiable",
    "experienceLevel": "entry, intermediate, or expert, based on real resume evidence, or null",
    "suggestedRange": "e.g. $18-$28/hr, or null",
    "note": "one short sentence naming the real evidence used, or null"
  },
  "gapsFlagged": ["short phrases naming real, practical things worth adding before this profile goes live"]
}
If rateSuggestion cannot be honestly filled in, set the whole rateSuggestion value to null rather than filling its fields with guesses.`;
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

function parseResumePdf(dataUrl) {
  const match = /^data:application\/pdf;base64,(.+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!match) return null;
  const [, data] = match;
  if (data.length > MAX_RESUME_BASE64_CHARS) return null;
  return { data };
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
  const resumeFileRaw = typeof body?.resumeFile === 'string' ? body.resumeFile.trim() : '';
  const resumeText = typeof body?.resumeText === 'string' ? body.resumeText.trim().slice(0, MAX_RESUME_TEXT_CHARS) : '';

  if (!isValidEmail(email)) {
    return Response.json(
      { error: 'invalid_email', message: 'Enter a valid email to run this check.' },
      { status: 400 }
    );
  }

  if (!resumeFileRaw && !resumeText) {
    return Response.json(
      { error: 'invalid_request', message: 'Upload your resume as a PDF, or paste the text instead.' },
      { status: 400 }
    );
  }

  let parsedResume = null;
  if (resumeFileRaw) {
    parsedResume = parseResumePdf(resumeFileRaw);
    if (!parsedResume) {
      return Response.json(
        {
          error: 'invalid_file',
          message: 'Could not read that file — upload it as a PDF under 5MB, or paste the text instead.',
        },
        { status: 400 }
      );
    }
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
        message: `You've used all ${creditStatus.total} free credits, shared across every tool (profile scan, title & overview, job match, and proposal writer). Subscribe to Upwork Freelancer Toolkit Unlimited for unlimited access.`,
        remaining: 0,
        total: creditStatus.total,
        subscribeUrl: 'https://stan.store/reymags/p/profile-rewriter--unlimited-access',
      },
      { status: 403 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const content = [];
    if (parsedResume) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: parsedResume.data },
      });
    }
    content.push({ type: 'text', text: buildResumePrompt(resumeText) });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2200,
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
    console.error('resume-import route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
