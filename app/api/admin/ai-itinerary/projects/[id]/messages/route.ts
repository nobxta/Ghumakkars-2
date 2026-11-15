import { adminRoute, isUuid, json, readJson } from '@/lib/ai-itinerary/http';
import { runTurn, StudioError } from '@/lib/ai-itinerary/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Send a chat message (or press "Generate"). The work is tied to a persisted job,
 * not to this HTTP request: if the browser refreshes, the job keeps running and
 * the studio picks the result up by polling the project.
 */
export const POST = adminRoute(async ({ req, params, userId }) => {
  const rate = checkRateLimit(req, `ai-itinerary:${userId}`, 120);
  if (rate.ok === false) return json({ error: 'Too many AI requests. Please wait a few minutes.' }, 429);
  const body = await readJson(req, 200_000);
  const clientId = typeof body.clientId === 'string' ? body.clientId.slice(0, 80) : '';
  if (!clientId) throw new StudioError(400, 'invalid', 'clientId is required');
  const referenceIds = Array.isArray(body.referenceIds) ? body.referenceIds.filter(isUuid) : [];
  const res = await runTurn({
    projectId: params.id,
    content: typeof body.content === 'string' ? body.content : '',
    clientId,
    modelKey: typeof body.model === 'string' ? body.model : null,
    referenceIds,
    forceGenerate: body.forceGenerate === true,
    priority: body.priority === true,
  });
  return json(res, res && 'ok' in res && res.ok === false ? 200 : 200);
});
