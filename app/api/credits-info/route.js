import { getFreeCreditsLimit } from '../../lib/credits';

// Tiny public endpoint so the frontend can show the current free-credit pool
// size before anyone submits anything (in the email hint, mainly). Exists
// because the pool size changes automatically on a date (see credits.js) —
// this keeps the displayed number honest without needing a redeploy when it
// shifts from the beta pool down to the standard one.
export async function GET() {
  return Response.json({ total: getFreeCreditsLimit() });
}
