import Anthropic from '@anthropic-ai/sdk';

function buildPrompt(title, overview) {
  return `You are reviewing an Upwork freelancer profile against a specific framework. Do not invent, exaggerate, or assume any facts, clients, years of experience, tools, credentials, or results that are not present in the text I give you.

FRAMEWORK
Title formula: [PRIMARY SERVICE] | [SPECIALIZATION] | [RELEVANT TOOL, INDUSTRY, OR NICHE]. A strong title clearly says what the person does, has an obvious primary service, is specific rather than generic, uses relevant keywords, has no unnecessary buzzwords, and is understandable in a few seconds.

Overview formula (5 parts): HOOK (starts with the client's problem, need, or desired outcome — not a personal introduction), WHAT I DO (clearly states the primary service and type of work), HOW I HELP (translates tasks into client value, not just a list of duties), PROOF (real evidence: years of experience, industries, volume handled, systems used, measurable outcomes), CTA (a simple, clear next step for the client).

First 250 characters formula: HOOK + SERVICE + VALUE. Upwork may show the start of the overview in search results, so the opening needs to earn attention on its own.

MY CURRENT TITLE:
${title || '(not provided)'}

MY CURRENT OVERVIEW:
${overview || '(not provided)'}

Evaluate each part above as "pass" or "weak" with a short one-sentence note explaining why. Then write a rewritten title (only if the title is weak) and a rewritten full overview using ONLY the facts, services, tools, and experience already present in what I gave you above — rearranged and clarified, never invented. If a section is weak specifically because real information is missing (for example, no proof of results at all), do not fabricate a stat, client, or achievement. Instead leave a bracketed placeholder like [add a specific result or metric here] in the rewritten copy, and also list that gap plainly in gapsFlagged so I know exactly what to fill in myself.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "titleCheck": {"status": "pass or weak", "note": "one sentence", "rewrittenTitle": "string, only if weak, else empty string"},
  "overviewCheck": {
    "hook": {"status": "pass or weak", "note": "one sentence"},
    "whatIDo": {"status": "pass or weak", "note": "one sentence"},
    "howIHelp": {"status": "pass or weak", "note": "one sentence"},
    "proof": {"status": "pass or weak", "note": "one sentence"}
  },
  "first250": {"status": "pass or weak", "note": "one sentence"},
  "rewrittenOverview": "the full rewritten overview as one string with blank lines between parts",
  "gapsFlagged": ["short phrases describing any real information the user needs to add themselves"]
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

  const title = typeof body?.title === 'string' ? body.title.slice(0, 2000) : '';
  const overview = typeof body?.overview === 'string' ? body.overview.slice(0, 8000) : '';

  if (!title.trim() && !overview.trim()) {
    return Response.json(
      { error: 'invalid_request', message: 'Provide a title or overview to analyze.' },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(title, overview) }],
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
    console.error('analyze route error:', err);
    return Response.json(
      { error: 'upstream_error', message: 'Something went wrong reaching the AI model. Try again.' },
      { status: 502 }
    );
  }
}
