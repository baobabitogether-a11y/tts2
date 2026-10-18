import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { synthesize, HttpError, bytesToB64 } from "@/lib/tts.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "X-Spoken-Text, X-Spoken-Lang, Content-Type",
};

const schema = z.object({
  text: z.string().trim().min(1).max(5000),
  lang: z.string().trim().min(2).max(20),
  target_lang: z.string().trim().max(20).optional().or(z.literal("")),
  provider: z.enum(["google", "lovable", "openrouter"]).default("google"),
  api_key: z.string().max(500).optional().or(z.literal("")),
  voice: z.string().max(50).optional().or(z.literal("")),
  format: z.enum(["binary", "json"]).default("binary"),
});

async function handle(raw: Record<string, unknown>) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS });
  const p = parsed.data;
  try {
    const r = await synthesize({
      text: p.text,
      lang: p.lang,
      targetLang: p.target_lang || undefined,
      provider: p.provider,
      apiKey: p.api_key || undefined,
      voice: p.voice || undefined,
    });
    if (p.format === "json")
      return Response.json({ audio: bytesToB64(r.audio), mime: r.mime, text: r.text, lang: r.lang }, { headers: CORS });
    return new Response(r.audio, {
      headers: {
        ...CORS,
        "Content-Type": r.mime,
        "X-Spoken-Text": encodeURIComponent(r.text.slice(0, 2000)),
        "X-Spoken-Lang": r.lang,
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status, headers: CORS });
  }
}

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => handle(Object.fromEntries(new URL(request.url).searchParams)),
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }
        return handle(body);
      },
    },
  },
});
