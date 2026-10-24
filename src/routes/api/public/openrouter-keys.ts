import { createFileRoute } from "@tanstack/react-router";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "*" };
async function handle(request: Request) {
  const pool = await import('@/lib/openrouter-pool.server');
  if (!await pool.authorizeManagement(request)) return Response.json({ error: 'Enter your management token or configured server OpenRouter key' }, { status: 401, headers: CORS });
  try {
    if (request.method === 'POST') {
      const body = await request.json() as { key?: unknown; reset?: unknown };
      if (typeof body.reset === 'string') {
        if (!await pool.resetKey(body.reset)) return Response.json({ error: 'Key not found' }, { status: 404, headers: CORS });
      } else {
        if (typeof body.key !== 'string' || !body.key.trim() || body.key.length > 500) return Response.json({ error: 'key is required' }, { status: 400, headers: CORS });
        if (!await pool.addKey(body.key)) return Response.json({ error: 'Key already exists' }, { status: 409, headers: CORS });
      }
    }
    if (request.method === 'DELETE' && !await pool.removeKey(new URL(request.url).searchParams.get('id') || '')) return Response.json({ error: 'Key not found or managed in server secrets' }, { status: 400, headers: CORS });
    return Response.json({ keys: await pool.listKeys(), quarantine_after: pool.QUARANTINE_AFTER, quarantine_minutes: pool.QUARANTINE_MS / 60000 }, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not update saved keys' }, { status: 500, headers: CORS });
  }
}

export const Route = createFileRoute("/api/public/openrouter-keys")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
      DELETE: async ({ request }) => handle(request),
    },
  },
});
