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
1. HOOK — follow the Opening Formula from the Upwork Proposal Builder guide: RELEVANCE → VALUE → CREDIBILITY. Lead with the client's own stated need or problem, restated in your own words from what THEY actually wrote in the job post below (not a general fact about their industry that they never mentioned), then connect it directly to the specific help you'd provide. Use whichever of these three angles fits the job post best:
   - The Specific Need: "You're looking for someone to [specific task/problem from the post]. I can help by [specific approach or outcome]."
   - The Relevant Experience: "I've handled [similar responsibility] using [tool/process], so I can step in and help with [client need]."
   - The Outcome: "If the goal is to [desired result they stated], I can help by [service/approach], backed by my experience in [relevant area]."
   Start that opening sentence with a short folded-in greeting, "Hi there, " (preferred, it reads warmer) or "Hi, ", followed immediately, in the same sentence, by the relevance point. For example: "Hi there, you're looking for someone to own customer support across your website and marketplace channels..."
   Phrase that relevance point as a reflection of what the client actually asked for in their post, never as a verdict on what they lack. Say "you're looking for someone to...", "you want...", or "you're hiring someone to..." Do NOT open with a flat "you need someone to...", because right after a greeting that reads like you're telling the client what their problem is, which is both presumptuous and awkward. The difference is small but it's the whole tone of the proposal: "Hi there, you're looking for someone to own customer support" sounds like a person who read the post, "Hi, you need someone to own customer support" sounds like a pitch deck.
   The greeting never sits on its own line, is never followed by your name, and is never followed by a separate sentence about yourself before you get to the client's need. The goal: make the client think "this person read my post and understands what I need," not "this person is introducing themselves."
2. HELP — explain clearly how you would approach the real work described in the job post. Focus on the work they need done, not everything you've ever learned.
3. PROOF — back up your single most relevant claim with one or two pieces of real evidence: similar experience, a specific tool or process, a measurable result, or a work sample — using only what's in my skills and overview above. Use this formula: state the claim, give the evidence, then briefly explain why that evidence matters for this job.
4. NEXT STEP — end with a simple, natural invitation to keep the conversation going: a relevant question, an offer to walk through next steps, or your availability to start.

Hook rules, because this is the part that most often reads as generic AI writing:
- The hook has to be built from something the client actually wrote in the job post: a task, a problem, a goal, a tool, a number, a deadline. Restate it in your own words. Do not introduce a problem, risk, or consequence the client didn't mention or clearly imply, even if it's true in general for that kind of work. If the job post never mentions a specific risk, don't invent one as your opening line.
- Never write a hook shaped like a general lesson about the industry: "[Doing X the wrong way] is where [bad outcome] happens" or "[Doing X] means/matters..." or "You need someone who can X, not just Y." These read like a course module teaching the client something, not like someone responding to their specific post.
- Good, straight from the guide, with the greeting folded in (mirrors what the client asked for, then connects it to real experience), and this whole example is about 200 characters including the greeting: "Hi there, you're looking for someone to keep your customer support queue organized and respond quickly to customers. I've handled high-volume ticket support using Zendesk to keep tickets from piling up."
- Bad (a general truism the writer came up with, not something the client said): "Manually updating stock levels without an API is where most overselling happens, so I'd build a daily sync routine to keep that under control." This teaches the client a lesson instead of showing you read their specific post, and it risks stating a problem they never actually raised.
- Keep the hook to roughly 250 characters or fewer, total, counting the greeting and every sentence in the hook together, not per sentence. If the job post mentions several platforms, tools, or tasks, do not name all of them in the hook, pick the ONE detail that matters most and open with that; the rest belongs in HELP and PROOF further down, not stacked into the opening. If the hook is running past about 250 characters, that means it's carrying too much detail, cut detail rather than add a third sentence.

Other rules:
- Keep it concise, natural, and conversational, like a real person wrote it, not a template. Avoid generic freelancer phrases such as "I am hardworking," "I am dedicated," "I am the perfect candidate," or "I would love the opportunity" unless something like that is genuinely necessary.
- Do not repeat the job post back to the client. Do not list every skill I have, only what's relevant to this job.
- Do not create fake statistics, clients, achievements, certifications, or portfolio items.
- Never use an em dash (—) anywhere in the proposal. Real people don't type them. Use a period, a comma, or a simple word like "and" or "but" instead.
- Aim for roughly 120-200 words: long enough to be substantive, short enough that a busy client actually reads the whole thing.
- If something that would strengthen the proposal is missing from what I gave you (a measurable result, a relevant tool, a work sample), do not invent it. Leave it out of the proposal and note the gap separately instead.

Reply with ONLY a JSON object, no other text, in exactly this shape:
{
  "proposal": "the full proposal, ready to paste into Upwork's cover letter box, with blank lines between the Hook/Help/Proof/Next Step sections",
  "openingPreview": "the first roughly 250 characters of the proposal, exactly as it starts",
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
