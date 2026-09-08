import Anthropic from '@anthropic-ai/sdk';
import { getCreditStatus, consumeCredit, isValidEmail } from '../../lib/credits';

function buildPrompt({ jobPost, skills, services }) {
  return `You are an Upwork proposal strategist, writing using the Hook, Help, Proof, Next Step framework from the Upwork Proposal Builder guide. Write a proposal cover letter that is honest, specific, and client-focused — never invented, exaggerated, or generic.

Do not invent, exaggerate, or assume any client, result, tool, or experience that isn't clearly supported by what I give you below.

THE JOB POSTING I'M APPLYING TO:
${jobPost}

MY CURRENT SKILLS:
${skills || '(not provided)'}

MY PROFILE OVERVIEW / SERVICES:
${services || '(not provided)'}

Write the proposal using this structure, in this order:
1. HOOK — open with something specific to this client's need, problem, or goal, pulled from the job post. Never start with a greeting, your name, or your biography. The goal: make the client think "this person actually read my post."
2. HELP — explain clearly how you would approach the real work described in the job post. Focus on the work they need done, not everything you've ever learned.
3. PROOF — back up your single most relevant claim with one or two pieces of real evidence: similar experience, a specific tool or process, a measurable result, or a work sample — using only what's in my skills and overview above. Use this formula: state the claim, give the evidence, then briefly explain why that evidence matters for this job.
4. NEXT STEP — end with a simple, natural invitation to keep the conversation going: a relevant question, an offer to walk through next steps, or your availability to start.

Rules:
- Keep it concise, natural, and conversational, like a real person wrote it, not a template. Avoid generic freelancer phrases such as "I am hardworking," "I am dedicated," "I am the perfect candidate," or "I would love the opportunity" unless something like that is genuinely necessary.
- Do not repeat the job post back to the client. Do not list every skill I have, only what's relevant to this job.
- Do not create fake statistics, clients, achievements, certifications, or portfolio items.
- Never use an em dash (—) anywhere in the proposal. Real people don't type them. Use a period, a comma, or a simple word like "and" or "but" instead.
- Aim for roughly 120-200 words: long enough to be substantive, short enough that a busy client actually reads the whole thing.
- If something that would strengthen the proposal is missing from what I gave you (a measurable result, a relevant tool, a work sample), do not invent it. Leave it out of the proposal and note the gap separately instead.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "proposal": "the full proposal, ready to paste into Upwork's cover letter box, with blank lines between the Hook/Help/Proof/Next Step sections",
  "openingPreview": "the first roughly 200 characters of the proposal, exactly as it starts",
  "whyRelevant": "one sentence on why this pitch fits what the client is asking for",
  "proofUsed": "one sentence naming the specific proof or experience used and why it was chosen",
  "suggestedQuestion": "one relevant, specific question worth asking this client, or an empty string if none is needed",
  "gapsFlagged": ["short phrases naming real information that would have strengthened this proposal but wasn't in what I gave you, e.g. no measurable result given, no relevant work sample available"]
}`;
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

  const jobPost = typeof body?.jobPost === 'string' ? body.jobPost.slice(0, 8000) : '';
  const skills = typeof body?.skills === 'string' ? body.skills.slice(0, 2000) : '';
  const services = typeof body?.services === 'string' ? body.services.slice(0, 5000) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';

  if (!isValidEmail(email)) {
    return Response.json(
      { error: 'invalid_email', message: 'Enter a valid email to write a proposal.' },
      { status: 400 }
    );
  }

  if (!jobPost.trim()) {
    return Response.json(
      { error: 'invalid_request', message: 'A proposal needs the job posting you\'re applying to.' },
      { status: 400 }
    );
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
        message: `You've used all ${creditStatus.total} free credits, shared across every tool (title & overview, job match, and proposal writer). Subscribe to Profile Rewriter Unlimited for unlimited access.`,
        remaining: 0,
        total: creditStatus.total,
        subscribeUrl: 'https://stan.store/reymags/p/profile-rewriter--unlimited-access',
      },
      { status: 403 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildPrompt({ jobPost, skills, services }) }],
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
    console.error('proposal route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
