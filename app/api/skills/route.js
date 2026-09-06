import Anthropic from '@anthropic-ai/sdk';
import { getCreditStatus, consumeCredit, isValidEmail } from '../../lib/credits';

function buildPrompt({ skills, services, mode, jobPost }) {
  const matchSection =
    mode === 'match' && jobPost
      ? `THE JOB POSTING I'M APPLYING TO:
${jobPost}

Since a job posting was given, run in JOB-MATCH mode: compare the job's language against my current skills and my services description. Fill in "matchedSkills" (skills I already listed that this job is clearly looking for — say why each matters for this job), and "realGaps" (skills this job wants that nothing in my skills list or services description supports — flag these honestly as real gaps to actually learn or confirm, never invent that I have them). Leave "matchedSkills" and "realGaps" as empty arrays only if genuinely nothing qualifies. Make "suggestedOrder" specifically prioritized for THIS job posting.

Also fill in "matchScore": estimate what percentage (0-100) of this job's core stated requirements are genuinely covered by my current skills plus my services description — base it on real overlap, not on skill count alone, and be honest even when it's discouraging. The point of this score is to stop me from spending a paid Upwork connect applying to a job I'm not ready for, not to make me feel good. Set "recommendation" to exactly one of "strong" (80-100 — a clear fit, apply with confidence), "moderate" (60-79 — a real but incomplete match, apply only if you can directly address the gaps in your proposal), or "weak" (below 60 — hold off on this one; the gaps are large enough that applying now is likely a wasted connect). Add a one-sentence "note" explaining the score in plain terms, referencing the actual gaps or strengths that drove it. If the recommendation is "weak", the note must also say plainly not to apply yet and to go update the skills list and profile overview to reflect real experience, then run this check again before applying.

Also fill in "interviewPrep": 4 to 6 realistic screening or interview questions a client would likely ask for THIS specific job, based on what the posting emphasizes, each paired with a one-sentence "tip" on how to approach answering it using my real skills and overview. Never invent a specific number, story, or outcome I haven't told you — if my overview doesn't give you enough to ground a tip in something real, keep the tip general (e.g. "have a concrete example ready for this").`
      : `No job posting was given, so run in GENERAL AUDIT mode. Leave "matchedSkills" and "realGaps" as empty arrays — those only apply when a specific job posting is being matched. Make "suggestedOrder" a sensible general-purpose order based on what's most central to my services. Set "matchScore" to {"percentage": null, "recommendation": null, "note": null} since there's no job posting to score against. Set "interviewPrep" to an empty array — there's no specific job to prep for.`;

  return `You are auditing an Upwork freelancer's skill list. Do not invent, exaggerate, or assume any skill, tool, or experience that is not clearly supported by the current skills list or the services description I give you.

CONTEXT
Upwork profiles allow a maximum of 20 skills. Skills affect which searches and job invitations a freelancer shows up in, and Upwork's matching tends to weight skills listed earlier as more relevant, so both which skills are listed and their order matter. More real, relevant skills listed (closer to the 20 cap) generally means showing up in more searches — so a short list is a real opportunity cost, not just a style issue.

MY CURRENT SKILLS (one per line or comma-separated):
${skills || '(not provided)'}

MY FULL PROFILE OVERVIEW (my complete Upwork summary — the more complete this is, the more real skills you should be able to find):
${services || '(not provided)'}

${matchSection}

General rules for every mode:
- "skillCountCheck": mark "weak" if the count is over 20 (say it must be trimmed) or if it's meaningfully under 20 for someone with a real services description (say they're likely missing easy wins and should add more). Otherwise "pass". Mention the actual count in the note.
- "suggestedAdds": be thorough here, not minimal. Read the services description closely and list every specific tool, platform, sub-skill, methodology, and adjacent competency it genuinely implies that isn't already in the current skills list — not just the one or two most obvious ones. The aim is for suggestedOrder (current skills + suggestedAdds) to get as close to the 20-skill cap as the person's real, described experience actually supports. Never invent a tool or skill they didn't mention or clearly imply, and never pad with generic filler just to hit a number — but don't stop short of 20 if more genuine skills are supported by what they described. Leave empty only if the list is already at or near 20 with nothing more to add.
- "possibleRemovals": skills already listed that are too vague, redundant with another listed skill, or unlikely to help (generic filler terms). Leave empty if the list is already clean.
- "suggestedOrder": the final recommended skill list, in priority order, capped at 20 entries, built only from skills that are either already listed or included in suggestedAdds — never a skill invented out of nowhere.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "skillCountCheck": {"status": "pass or weak", "note": "one sentence mentioning the actual count"},
  "matchScore": {"percentage": number or null, "recommendation": "strong, moderate, weak, or null", "note": "string or null"},
  "matchedSkills": [{"skill": "string", "reason": "one sentence"}],
  "suggestedAdds": [{"skill": "string", "reason": "one sentence"}],
  "possibleRemovals": [{"skill": "string", "reason": "one sentence"}],
  "realGaps": [{"skill": "string", "reason": "one sentence"}],
  "suggestedOrder": ["skill1", "skill2"],
  "interviewPrep": [{"question": "string", "tip": "one sentence"}]
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

  const skills = typeof body?.skills === 'string' ? body.skills.slice(0, 2000) : '';
  const services = typeof body?.services === 'string' ? body.services.slice(0, 5000) : '';
  const mode = body?.mode === 'match' ? 'match' : 'audit';
  const jobPost = typeof body?.jobPost === 'string' ? body.jobPost.slice(0, 8000) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';

  if (!isValidEmail(email)) {
    return Response.json(
      { error: 'invalid_email', message: 'Enter a valid email to run this check.' },
      { status: 400 }
    );
  }

  if (!skills.trim()) {
    return Response.json(
      { error: 'invalid_request', message: 'Provide your current skills to check.' },
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
        message:
          "You've used all 5 free checks for this email. Subscribe to Profile Rewriter Unlimited for unlimited checks.",
        remaining: 0,
        subscribeUrl: 'https://stan.store/reymags/p/profile-rewriter--unlimited-access',
      },
      { status: 403 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt({ skills, services, mode, jobPost }) }],
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

    const { remaining, unlimited } = await consumeCredit(email);
    return Response.json({ ...data, creditsRemaining: remaining, unlimitedAccess: Boolean(unlimited) });
  } catch (err) {
    console.error('skills route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
