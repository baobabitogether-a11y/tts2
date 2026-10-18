import { createFileRoute } from "@tanstack/react-router";
import { startedAt, keyStatus, getOpenRouterKeys, redact } from "@/lib/tts.server";
import { cacheInfo, history } from "@/lib/monitor.server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" };

async function credits(key: string) {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const { data } = (await r.json()) as { data: { usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean } };
    return { usage: data.usage ?? null, limit: data.limit ?? null, remaining: data.limit_remaining ?? null, free_tier: data.is_free_tier ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "failed" };
  }
}

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const up = Math.floor((Date.now() - startedAt) / 1000);
        const keys = getOpenRouterKeys();
        const openrouter = await Promise.all(
          keys.map(async (k, i) => ({
            position: i,
            key: redact(k),
            ...(keyStatus.get(k) ?? { status: "unknown" }),
            credits: await credits(k),
          })),
        );
        return Response.json(
          {
            status: "ok",
            started_at: new Date(startedAt).toISOString(),
            uptime_seconds: up,
            uptime: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${up % 60}s`,
            lovable_api_key: process.env["LOVABLE_API_KEY"] ? "configured" : "missing",
            openrouter_keys: openrouter,
            cache: cacheInfo(),
            requests_recorded: history.length,
          },
          { headers: CORS },
        );
      },
    },
  },
});
