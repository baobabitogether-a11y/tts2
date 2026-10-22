import { createFileRoute } from "@tanstack/react-router";
import { listKeys, addKey, removeKey, resetKey, QUARANTINE_AFTER, QUARANTINE_MS } from "@/lib/tts.server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "*" };
const list = () => Response.json({ keys: listKeys(), quarantine_after: QUARANTINE_AFTER, quarantine_minutes: QUARANTINE_MS / 60000 }, { headers: CORS });

export const Route = createFileRoute("/api/public/openrouter-keys")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => list(),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { key?: unknown; reset?: unknown };
        if (typeof body.reset === "string") {
          if (!resetKey(body.reset)) return Response.json({ error: "Key not found" }, { status: 404, headers: CORS });
          return list();
        }
        if (typeof body.key !== "string" || body.key.length > 500 || !body.key.trim())
          return Response.json({ error: "key is required" }, { status: 400, headers: CORS });
        if (!addKey(body.key)) return Response.json({ error: "Key already exists" }, { status: 409, headers: CORS });
        return list();
      },
      DELETE: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const r = removeKey(id);
        if (r === "env") return Response.json({ error: "This key comes from server settings and can't be removed here" }, { status: 400, headers: CORS });
        if (r === "missing") return Response.json({ error: "Key not found" }, { status: 404, headers: CORS });
        return list();
      },
    },
  },
});
