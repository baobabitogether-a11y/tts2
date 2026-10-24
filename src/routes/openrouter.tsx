import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from '@/components/ui/button';

export const Route = createFileRoute("/openrouter")({
  head: () => ({
    meta: [
      { title: "OpenRouter keys — Speak API" },
      { name: "description", content: "Manage the pool of OpenRouter API keys used for load-balanced text-to-speech." },
      { property: "og:title", content: "OpenRouter keys — Speak API" },
      { property: "og:description", content: "Add, remove and monitor round-robin OpenRouter API keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Keys,
});

type K = { id: string; key: string; source: string; status: string; failures?: number; lastError?: string; quarantinedUntil?: number; lastUsed?: number };
const API = "/api/public/openrouter-keys";

function Keys() {
  const [keys, setKeys] = useState<K[]>([]);
  const [meta, setMeta] = useState({ after: 10, mins: 15 });
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [token, setToken] = useState('');

  async function call(init?: RequestInit, url = API) {
    setErr("");
    const r = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) return setErr(j.error ?? "Request failed");
    setKeys(j.keys);
    setMeta({ after: j.quarantine_after, mins: j.quarantine_minutes });
  }
  const post = (body: object) => call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
      <h1 className="mt-4 text-2xl font-semibold">OpenRouter keys</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Saved in Cloud · Quarantine: {meta.after} failures / {meta.mins} min
      </p>
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void call(); }}>
        <input aria-label="Management token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Management token or server OpenRouter key" className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm" />
        <Button type="submit" variant="outline">Unlock</Button>
      </form>
      <form
        className="mt-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await post({ key: input });
          setInput("");
        }}
      >
        <input aria-label="OpenRouter API key" type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="OpenRouter API key" className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
        <Button disabled={!token}>Add</Button>
      </form>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <ul className="mt-6 divide-y divide-border border border-border">
        {keys.length === 0 && <li className="p-3 text-sm text-muted-foreground">No keys yet.</li>}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 p-3 text-sm">
            <code className="min-w-0 flex-1 break-all">Key {keys.indexOf(k) + 1}</code>
            <span className="text-xs text-muted-foreground">{k.source}</span>
            <span className={k.status === "ok" ? "text-foreground" : k.status === "unknown" ? "text-muted-foreground" : "text-destructive"} title={k.lastError}>
              {k.status}
              {k.failures ? ` (${k.failures})` : ""}
            </span>
            {(k.failures || k.status === "quarantined") && (
              <Button variant="ghost" size="sm" onClick={() => post({ reset: k.id })}>reset</Button>
            )}
            {k.source === "saved" && (
              <Button variant="ghost" size="sm" onClick={() => call({ method: "DELETE" }, `${API}?id=${k.id}`)}>remove</Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
