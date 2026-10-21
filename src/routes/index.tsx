import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { openApiSpec } from "@/lib/openapi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Speak API — Text to speech with translation" },
      { name: "description", content: "Open API for text-to-speech via Google, Lovable AI or OpenRouter, with optional translation." },
      { property: "og:title", content: "Speak API" },
      { property: "og:description", content: "Text-to-speech API with translation. Google, Lovable AI, OpenRouter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const field = "w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

function Index() {
  const [form, setForm] = useState({ text: "Hello world", lang: "en", target_lang: "", provider: "google", api_key: "", voice: "", speed: "1", options: "" });
  const [audio, setAudio] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function run() {
    setBusy(true);
    setInfo("");
    setAudio(null);
    try {
      let options: Record<string, unknown> | undefined;
      if (form.options.trim()) {
        try {
          options = JSON.parse(form.options);
        } catch {
          throw new Error("options is not valid JSON");
        }
      }
      const body: Record<string, unknown> = {
        text: form.text,
        lang: form.lang,
        provider: form.provider,
        ...(form.target_lang && { target_lang: form.target_lang }),
        ...(form.api_key && { api_key: form.api_key }),
        ...(form.voice && { voice: form.voice }),
        ...(Number(form.speed) !== 1 && { speed: Number(form.speed) }),
        ...(options && { options }),
      };
      const res = await fetch("/api/public/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(JSON.stringify(await res.json()));
      const blob = await res.blob();
      setAudio(URL.createObjectURL(blob));
      setInfo(`${blob.type} · ${(blob.size / 1024).toFixed(1)} KB · "${decodeURIComponent(res.headers.get("X-Spoken-Text") || "")}"`);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-mono text-foreground">
      <h1 className="text-2xl font-bold">speak/api</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Text → (translate) → audio. CORS open. Spec: <a className="underline" href="/api/public/openapi.json">/api/public/openapi.json</a>
      </p>

      <section className="mt-10 space-y-3">
        <textarea className={field} rows={3} value={form.text} onChange={set("text")} />
        <div className="grid grid-cols-3 gap-3">
          <input className={field} placeholder="lang" value={form.lang} onChange={set("lang")} />
          <input className={field} placeholder="target_lang" value={form.target_lang} onChange={set("target_lang")} />
          <select className={field} value={form.provider} onChange={set("provider")}>
            <option>google</option>
            <option>lovable</option>
            <option>openrouter</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="voice (optional)" value={form.voice} onChange={set("voice")} />
          {form.provider === "openrouter" && (
            <input className={field} type="password" placeholder="api_key (optional)" value={form.api_key} onChange={set("api_key")} />
          )}
        </div>
        <label className="block text-xs text-muted-foreground">
          speed: {form.speed}x
          <input className="w-full accent-foreground" type="range" min="0.25" max="4" step="0.25" value={form.speed} onChange={set("speed")} />
        </label>
        {form.provider !== "google" && (
          <textarea
            className={field}
            rows={2}
            placeholder='options (optional JSON, e.g. {"model":"…"})'
            value={form.options}
            onChange={set("options")}
          />
        )}
        <button onClick={run} disabled={busy} className="bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50">
          {busy ? "…" : "POST /api/public/tts"}
        </button>
        {audio && <audio className="w-full" controls autoPlay src={audio} />}
        {info && <p className="break-all text-xs text-muted-foreground">{info}</p>}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold">curl</h2>
        <pre className="mt-2 overflow-x-auto bg-muted p-3 text-xs">{`curl "$HOST/api/public/tts?text=Hello&lang=en&target_lang=fr&provider=google" -o out.mp3`}</pre>
        <h2 className="mt-6 text-sm font-bold">OpenAPI</h2>
        <pre className="mt-2 max-h-96 overflow-auto bg-muted p-3 text-xs">{JSON.stringify(openApiSpec, null, 2)}</pre>
      </section>
    </main>
  );
}
