import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type ProviderKey = {
  id: string;
  service: string;
  status: string;
  failures: number;
  code: number | null;
  created_at: string;
  last_used: string | null;
};
type ApiToken = {
  id: string;
  label: string;
  created_at: string;
  last_used: string | null;
  revoked_at: string | null;
};
type UsageReport = {
  window_hours: number;
  totals: {
    requests: number;
    successful: number;
    failed: number;
    input_chars: number;
    output_chars: number;
    estimated_input_tokens: number;
    provider_input_tokens: number;
    provider_output_tokens: number;
  };
};

const services = [
  ["openrouter", "OpenRouter"],
  ["lovable", "Lovable AI"],
  ["gemini", "Google Gemini"],
  ["openai", "OpenAI"],
  ["elevenlabs", "ElevenLabs"],
  ["deepgram", "Deepgram"],
  ["azure", "Azure Speech (region:key)"],
  ["googlecloud", "Google Cloud TTS"],
] as const;
const field = "w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account and API keys — Speak API" },
      { name: "description", content: "Create an account, manage personal provider keys and API tokens, and view private usage." },
    ],
  }),
  component: Account,
});

function Account() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<(typeof services)[number][0]>("openrouter");
  const [providerKey, setProviderKey] = useState("");
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokenLabel, setTokenLabel] = useState("External agent");
  const [freshToken, setFreshToken] = useState("");
  const [usage, setUsage] = useState<UsageReport | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    const failInitialization = (reason: unknown) => {
      if (!mounted) return;
      setAuthUnavailable(reason instanceof Error ? reason.message : String(reason));
      setLoadingSession(false);
    };

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
      unsubscribe = () => data.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          setLoadingSession(false);
        }
      }).catch(failInitialization);
    } catch (reason) {
      failInitialization(reason);
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setKeys([]);
      setTokens([]);
      setUsage(null);
      return;
    }
    let active = true;
    void loadAccount(session.access_token).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [session?.access_token]);

  async function loadAccount(accessToken: string) {
    setError("");
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [keyResponse, tokenResponse, usageResponse] = await Promise.all([
      fetch("/api/user/provider-keys", { headers }),
      fetch("/api/user/token", { headers }),
      fetch("/api/public/usage?hours=168", { headers }),
    ]);
    const [keyBody, tokenBody, usageBody] = await Promise.all([
      keyResponse.json(), tokenResponse.json(), usageResponse.json(),
    ]);
    if (!keyResponse.ok) throw new Error(keyBody.error || "Could not load your provider keys");
    if (!tokenResponse.ok) throw new Error(tokenBody.error || "Could not load your API tokens");
    if (!usageResponse.ok) throw new Error(usageBody.error || "Could not load your usage");
    setKeys(keyBody.keys as ProviderKey[]);
    setTokens(tokenBody.tokens as ApiToken[]);
    setUsage(usageBody as UsageReport);
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setAuthMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!data.session) setAuthMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function accountRequest(path: string, init: RequestInit = {}) {
    if (!session?.access_token) throw new Error("Sign in to continue");
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Account request failed");
    return body;
  }

  async function addKey(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await accountRequest("/api/user/provider-keys", {
        method: "POST",
        body: JSON.stringify({ service: provider, key: providerKey }),
      });
      setProviderKey("");
      await loadAccount(session!.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(id: string) {
    setError("");
    try {
      await accountRequest(`/api/user/provider-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadAccount(session!.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function createToken(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFreshToken("");
    try {
      const result = await accountRequest("/api/user/token", {
        method: "POST",
        body: JSON.stringify({ label: tokenLabel }),
      }) as { token: string };
      setFreshToken(result.token);
      await loadAccount(session!.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    setError("");
    try {
      await accountRequest(`/api/user/token?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (tokens.find(token => token.id === id)) setFreshToken("");
      await loadAccount(session!.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setFreshToken("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <nav className="flex gap-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Back to speech</Link>
        <Link to="/reports" className="hover:text-foreground">Usage</Link>
      </nav>
      <h1 className="mt-5 text-2xl font-semibold">Your Speak API account</h1>
      {loadingSession ? <p className="mt-5 text-sm text-muted-foreground">Loading account…</p> : authUnavailable ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          Account authentication couldn’t be initialized: {authUnavailable}
        </p>
      ) : !session ? (
        <section className="mt-6 max-w-md">
          <div className="mb-4 flex gap-4 text-sm">
            <button type="button" className={mode === "signup" ? "font-semibold text-foreground" : "text-muted-foreground"} onClick={() => setMode("signup")}>Create account</button>
            <button type="button" className={mode === "signin" ? "font-semibold text-foreground" : "text-muted-foreground"} onClick={() => setMode("signin")}>Sign in</button>
          </div>
          <form className="space-y-3" onSubmit={authenticate}>
            <label className="block text-xs text-muted-foreground">Email<input className={`${field} mt-1`} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label className="block text-xs text-muted-foreground">Password<input className={`${field} mt-1`} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
          </form>
          {authMessage && <p className="mt-3 text-sm text-foreground">{authMessage}</p>}
        </section>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm">
            <span>{session.user.email}</span>
            <Button type="button" variant="outline" onClick={signOut}>Sign out</Button>
          </div>
          <section className="mt-6">
            <h2 className="text-base font-semibold">Provider keys</h2>
            <form className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]" onSubmit={addKey}>
              <label className="sr-only" htmlFor="account-provider">Provider</label>
              <select id="account-provider" className={field} value={provider} onChange={event => setProvider(event.target.value as typeof provider)}>
                {services.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <label className="sr-only" htmlFor="account-provider-key">Provider API key</label>
              <input id="account-provider-key" className={field} type="password" autoComplete="off" required value={providerKey} onChange={event => setProviderKey(event.target.value)} placeholder="Paste your provider API key" />
              <Button type="submit" disabled={busy}>Save key</Button>
            </form>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {keys.length === 0 && <li className="py-3 text-sm text-muted-foreground">No personal provider keys saved.</li>}
              {keys.map(key => (
                <li key={key.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="min-w-32 flex-1">{services.find(([id]) => id === key.service)?.[1] || key.service}</span>
                  <span className="text-muted-foreground">{key.status}{key.failures ? ` (${key.failures} failures)` : ""}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void removeKey(key.id)}>Remove</Button>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-base font-semibold">Personal API tokens</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a bearer token for an external agent. The secret is shown once; only its hash is stored.</p>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={createToken}>
              <label className="sr-only" htmlFor="token-label">Token label</label>
              <input id="token-label" className={`${field} min-w-48 flex-1`} value={tokenLabel} onChange={event => setTokenLabel(event.target.value)} maxLength={80} />
              <Button type="submit" disabled={busy}>Create token</Button>
            </form>
            {freshToken && <div className="mt-3 border border-border p-3">
              <p className="text-sm font-medium">Copy this token now. It cannot be shown again.</p>
              <code className="mt-2 block break-all text-xs">{freshToken}</code>
            </div>}
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {tokens.length === 0 && <li className="py-3 text-sm text-muted-foreground">No personal tokens yet.</li>}
              {tokens.map(token => (
                <li key={token.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="min-w-40 flex-1">{token.label}</span>
                  <span className="text-xs text-muted-foreground">{token.revoked_at ? "Revoked" : token.last_used ? `Used ${new Date(token.last_used).toLocaleString()}` : "Not used"}</span>
                  {!token.revoked_at && <Button type="button" variant="ghost" size="sm" onClick={() => void revokeToken(token.id)}>Revoke</Button>}
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-base font-semibold">Usage this week</h2>
            {usage ? <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Requests" value={usage.totals.requests} />
              <Metric label="Success / failed" value={`${usage.totals.successful} / ${usage.totals.failed}`} />
              <Metric label="Estimated tokens" value={usage.totals.estimated_input_tokens} />
              <Metric label="Characters in / out" value={`${usage.totals.input_chars} / ${usage.totals.output_chars}`} />
            </dl> : <p className="mt-2 text-sm text-muted-foreground">No usage data yet.</p>}
          </section>
        </>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd></div>;
}
