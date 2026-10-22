// Server-only TTS + translation providers.
export type Provider = "google" | "lovable" | "openrouter";
export type TtsInput = {
  text: string;
  lang: string;
  targetLang?: string | undefined;
  provider: Provider;
  apiKey?: string | undefined;
  voice?: string | undefined;
  speed?: number | undefined;
  options?: Record<string, unknown> | undefined;
};
export type TtsResult = { audio: Uint8Array; mime: string; text: string; lang: string };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Reads an SSE body, calling onData for every `data:` payload.
async function readSse(res: Response, onData: (data: string) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) {
        const d = line.slice(5).trim();
        if (d && d !== "[DONE]") onData(d);
      }
    }
  }
}

function chunkText(text: string, max = 180): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      chunks.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) chunks.push(cur);
  return chunks.flatMap((c) => (c.length > max ? (c.match(new RegExp(`.{1,${max}}`, "g")) ?? []) : [c]));
}

// ---------------- Google ----------------
async function googleTranslate(text: string, sl: string, tl: string) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl || "auto")}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new HttpError(502, `Google translate failed (${res.status})`);
  const data = (await res.json()) as [Array<[string]>];
  return data[0].map((s) => s[0]).join("");
}

async function googleTts(text: string, lang: string, speed?: number) {
  const parts: Uint8Array[] = [];
  const chunks = chunkText(text);
  const speedParam = speed ? `&ttsspeed=${speed}` : "";
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] ?? "";
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}&total=${chunks.length}&idx=${i}&textlen=${chunk.length}${speedParam}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://translate.google.com/" } });
    if (!res.ok) throw new HttpError(502, `Google TTS failed (${res.status})`);
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  return concat(parts);
}

// ---------------- Lovable AI ----------------
function lovableKey() {
  const k = process.env['LOVABLE_API_KEY'];
  if (!k) throw new HttpError(500, "LOVABLE_API_KEY is not configured");
  return k;
}

function translatePrompt(text: string, sl: string, tl: string) {
  return `Translate the following text${sl ? ` from ${sl}` : ""} to the language with code "${tl}". Reply with the translation only, nothing else.\n\n${text}`;
}

async function lovableTranslate(text: string, sl: string, tl: string) {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey()}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: translatePrompt(text, sl, tl),
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });
  if (!res.ok) throw new HttpError(res.status, `Lovable translate failed: ${(await res.text()).slice(0, 300)}`);
  let out = "";
  await readSse(res, (d) => {
    try {
      const e = JSON.parse(d);
      if (e.type === "response.output_text.delta") out += e.delta;
    } catch {}
  });
  if (!out.trim()) throw new HttpError(502, "Lovable translate returned empty text");
  return out.trim();
}

async function lovableTts(text: string, voice = "Kore", speed?: number, options?: Record<string, unknown>) {
  // Gemini TTS has no numeric speed param; steer pacing with a style instruction.
  const spoken = speed && speed !== 1 ? `Say this ${speed < 1 ? "slowly" : "quickly"} (about ${speed}x normal pace): ${text}` : text;
  const res = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: spoken }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      stream_format: "audio",
      ...options,
    }),
  });
  if (!res.ok) throw new HttpError(res.status, `Lovable TTS failed: ${(await res.text()).slice(0, 300)}`);
  return { audio: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") || "audio/wav" };
}

// ---------------- OpenRouter key pool ----------------
// Pool = keys from OPENROUTER_API_KEYS env + keys added at runtime (in memory).
// Round-robin: each request starts at the next key. Failed keys are retried on the
// next one; after QUARANTINE_AFTER consecutive failures a key is benched for QUARANTINE_MS.
export const QUARANTINE_AFTER = 10;
export const QUARANTINE_MS = 15 * 60 * 1000;
const runtimeKeys: string[] = [];
let rrIndex = 0;
export const startedAt = Date.now();
export type KeyStatus = {
  status: "unknown" | "ok" | "blocked" | "error" | "quarantined";
  code?: number;
  lastUsed?: number;
  lastError?: string;
  failures?: number;
  quarantinedUntil?: number;
};
export const keyStatus = new Map<string, KeyStatus>();

function envKeys(): string[] {
  return (process.env["OPENROUTER_API_KEYS"] || "").split(/[\s,]+/).filter(Boolean);
}
export function getOpenRouterKeys() {
  return [...new Set([...envKeys(), ...runtimeKeys])];
}
export function listKeys() {
  const env = new Set(envKeys());
  return getOpenRouterKeys().map((k) => {
    const s = keyStatus.get(k) ?? { status: "unknown" as const };
    const q = s.quarantinedUntil && s.quarantinedUntil > Date.now();
    return { id: keyId(k), key: redact(k), source: env.has(k) ? "env" : "runtime", ...s, status: q ? "quarantined" : s.status };
  });
}
export function keyId(k: string) {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export function addKey(k: string) {
  const key = k.trim();
  if (!key) return false;
  if (getOpenRouterKeys().includes(key)) return false;
  runtimeKeys.push(key);
  return true;
}
export function removeKey(id: string): "ok" | "env" | "missing" {
  const i = runtimeKeys.findIndex((k) => keyId(k) === id);
  if (i >= 0) {
    keyStatus.delete(runtimeKeys[i]!);
    runtimeKeys.splice(i, 1);
    return "ok";
  }
  return envKeys().some((k) => keyId(k) === id) ? "env" : "missing";
}
export function resetKey(id: string) {
  const k = getOpenRouterKeys().find((x) => keyId(x) === id);
  if (!k) return false;
  keyStatus.delete(k);
  return true;
}
export function redact(k: string) {
  return k.length <= 10 ? "***" : `${k.slice(0, 6)}…${k.slice(-4)}`;
}
const BLOCKED = new Set([401, 402, 403, 429]);
function mark(key: string, code: number, err?: string) {
  const prev = keyStatus.get(key);
  const ok = code < 300;
  const failures = ok ? 0 : (prev?.failures ?? 0) + 1;
  const s: KeyStatus = {
    status: ok ? "ok" : BLOCKED.has(code) ? "blocked" : "error",
    code,
    lastUsed: Date.now(),
    failures,
    ...(err ? { lastError: err.slice(0, 200) } : {}),
  };
  if (failures >= QUARANTINE_AFTER) {
    s.status = "quarantined";
    s.quarantinedUntil = Date.now() + QUARANTINE_MS;
  }
  keyStatus.set(key, s);
}
function available(): string[] {
  const now = Date.now();
  const all = getOpenRouterKeys();
  const live = all.filter((k) => {
    const q = keyStatus.get(k)?.quarantinedUntil;
    return !q || q <= now;
  });
  if (!live.length) return [];
  const start = rrIndex++ % live.length;
  return [...live.slice(start), ...live.slice(0, start)];
}

async function withOpenRouterKey<T>(apiKey: string | undefined, fn: (key: string) => Promise<Response>, parse: (r: Response) => Promise<T>): Promise<T> {
  const suppliedKey = apiKey?.trim();
  if (suppliedKey) {
    const r = await fn(suppliedKey);
    if (!r.ok) throw new HttpError(r.status, `OpenRouter error: ${(await r.text()).slice(0, 300)}`);
    return parse(r);
  }
  if (!getOpenRouterKeys().length) throw new HttpError(400, "No OpenRouter api_key provided and no server keys configured (add some at /openrouter)");
  const keys = available();
  if (!keys.length) throw new HttpError(503, "All server OpenRouter keys are quarantined");
  let lastErr = "";
  let lastStatus = 503;
  for (const key of keys) {
    let r: Response;
    try {
      r = await fn(key);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network error";
      mark(key, 599, lastErr);
      continue;
    }
    if (r.ok) {
      mark(key, r.status);
      return parse(r);
    }
    lastErr = `${r.status} ${(await r.text()).slice(0, 200)}`;
    mark(key, r.status, lastErr);
    lastStatus = r.status;
    if (BLOCKED.has(r.status) || r.status >= 500) continue;
    throw new HttpError(r.status, `OpenRouter error: ${lastErr}`);
  }
  throw new HttpError(lastStatus >= 400 && lastStatus < 500 ? lastStatus : 502, `All OpenRouter keys failed. Last: ${lastErr}`);
}

function orFetch(key: string, body: unknown) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function openrouterTranslate(text: string, sl: string, tl: string, apiKey?: string) {
  return withOpenRouterKey(
    apiKey,
    (k) => orFetch(k, { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: translatePrompt(text, sl, tl) }] }),
    async (r) => {
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const t = j.choices?.[0]?.message?.content?.trim();
      if (!t) throw new HttpError(502, "OpenRouter translate returned empty text");
      return t;
    },
  );
}

async function openrouterTts(text: string, voice = "b347db033a6549378b48d00acb0d06cd", apiKey?: string, speed?: number, options?: Record<string, unknown>) {
  const model = typeof options?.["model"] === "string" ? options["model"] : "fish-audio/s2.1-pro-free:free";
  return withOpenRouterKey(
    apiKey,
    (k) =>
      fetch("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...options, input: text, model, response_format: "mp3", speed: speed ?? 1, voice }),
      }),
    async (r) => new Uint8Array(await r.arrayBuffer()),
  );
}

// ---------------- Entry ----------------
export async function synthesize(input: TtsInput): Promise<TtsResult> {
  let { text } = input;
  const target = input.targetLang?.trim();
  if (target && target !== input.lang) {
    if (input.provider === "google") text = await googleTranslate(text, input.lang, target);
    else if (input.provider === "lovable") text = await lovableTranslate(text, input.lang, target);
    else text = await openrouterTranslate(text, input.lang, target, input.apiKey);
  }
  const lang = target || input.lang;
  if (input.provider === "google") return { audio: await googleTts(text, lang, input.speed), mime: "audio/mpeg", text, lang };
  if (input.provider === "lovable") {
    const r = await lovableTts(text, input.voice, input.speed, input.options);
    return { ...r, text, lang };
  }
  return { audio: await openrouterTts(text, input.voice, input.apiKey, input.speed, input.options), mime: "audio/mpeg", text, lang };
}

export function bytesToB64(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
