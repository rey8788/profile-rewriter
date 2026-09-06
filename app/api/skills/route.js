import Anthropic from '@anthropic-ai/sdk';

function buildPrompt({ skills, services, mode, jobPost }) {
  const matchSection =
    mode === 'match' && jobPost
      ? `THE JOB POSTING I'M APPLYING TO:
${jobPost}

Since a job posting was given, run in JOB-MATCH mode: compare the job's language against my current skills and my services description. Fill in "matchedSkills" (skills I already listed that this job is clearly looking for — say why each matters for this job), and "realGaps" (skills this job wants that nothing in my skills list or services description supports — flag these honestly as real gaps to actually learn or confirm, never invent that I have them). Leave "matchedSkills" and "realGaps" as empty arrays only if genuinely nothing qualifies. Make "suggestedOrder" specifically prioritized for THIS job posting.

Also fill in "matchScore": estimate what percentage (0-100) of this job's core stated requirements are genuinely covered by my current skills plus my services description — base it on real overlap, not on skill count alone. Set "recommendation" to exactly one of "strong" (roughly 75-100 — a clear fit, apply with confidence), "moderate" (roughly 45-74 — apply, but use the cover letter/proposal to address the gaps), or "weak" (below 45 — the gaps are significant enough that I should close them first or think twice before applying). Add a one-sentence "note" explaining the score in plain terms, referencing the actual gaps or strengths that drove it.`
      : `No job posting was given, so run in GENERAL AUDIT mode. Leave "matchedSkills" and "realGaps" as empty arrays — those only apply when a specific job posting is being matched. Make "suggestedOrder" a sensible general-purpose order based on what's most central to my services. Set "matchScore" to {"percentage": null, "recommendation": null, "note": null} since there's no job posting to score against.`;

  return `You are auditing an Upwork freelancer's skill list. Do not invent, exaggerate, or assume any skill, tool, or experience that is not clearly supported by the current skills list or the services description I give you.

CONTEXT
Upwork profiles allow a maximum of 20 skills. Skills affect which searches and job invitations a freelancer shows up in, and Upwork's matching tends to weight skills listed earlier as more relevant, so both which skills are listed and their order matter. More real, relevant skills listed (closer to the 20 cap) generally means showing up in more searches — so a short list is a real opportunity cost, not just a style issue.

MY CURRENT SKILLS (one per line or comma-separated):
${skills || '(not provided)'}

WHAT I ACTUALLY DO:
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
  "suggestedOrder": ["skill1", "skill2"]
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
  const services = typeof body?.services === 'string' ? body.services.slice(0, 3000) : '';
  const mode = body?.mode === 'match' ? 'match' : 'audit';
  const jobPost = typeof body?.jobPost === 'string' ? body.jobPost.slice(0, 8000) : '';

  if (!skills.trim()) {
    return Response.json(
      { error: 'invalid_request', message: 'Provide your current skills to check.' },
      { status: 400 }
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

    return Response.json(data);
  } catch (err) {
    console.error('skills route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
