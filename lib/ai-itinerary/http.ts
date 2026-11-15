import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { AiError } from './codex';
import { StudioError } from './service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

type Handler<C> = (ctx: C & { userId: string }) => Promise<Response>;

/** Admin-only route wrapper with consistent JSON errors. Never leaks secrets or stack traces. */
export function adminRoute<C extends { params?: Record<string, string> }>(fn: Handler<{ req: Request; params: Record<string, string> }>) {
  return async (req: Request, ctx: C) => {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const params = (ctx?.params || {}) as Record<string, string>;
    for (const [k, v] of Object.entries(params)) {
      if ((k === 'id' || k.endsWith('Id')) && !isUuid(v)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
      return await fn({ req, params, userId: auth.user.id });
    } catch (e) {
      if (e instanceof StudioError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof AiError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === 'busy' ? 409 : 502 });
      console.error('[ai-itinerary]', (e as Error)?.message);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

export async function readJson(req: Request, maxBytes = 2_000_000): Promise<any> {
  const text = await req.text();
  if (text.length > maxBytes) throw new StudioError(413, 'too_large', 'Request is too large');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new StudioError(400, 'bad_json', 'Invalid JSON');
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
