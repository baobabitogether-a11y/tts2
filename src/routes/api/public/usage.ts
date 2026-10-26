import { createFileRoute } from "@tanstack/react-router";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization" };

export const Route = createFileRoute("/api/public/usage")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const pool = await import("@/lib/openrouter-pool.server");
        if (!await pool.authorizeManagement(request)) return Response.json({ error: "Management authorization required" }, { status: 401, headers: CORS });
        const requested = Number(new URL(request.url).searchParams.get("hours")) || 24;
        const windowHours = Math.max(1, Math.min(720, Math.floor(requested)));
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("provider_usage_report", { window_hours: windowHours });
          if (error) throw error;
          return Response.json(data, { headers: { ...CORS, "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "Could not load usage report" }, { status: 503, headers: CORS });
        }
      },
    },
  },
});