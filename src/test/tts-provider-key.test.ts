import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const poolState = vi.hoisted(() => ({
  error: null as Error | null,
  rows: [] as unknown[],
  marked: [] as Array<[string, number]>,
}));

vi.mock("@/lib/openrouter-pool.server", () => ({
  KEY_SERVICES: ["openrouter", "lovable", "gemini", "openai", "elevenlabs"],
  poolRows: async () => {
    if (poolState.error) throw poolState.error;
    return poolState.rows;
  },
  reserveAnyKey: async (excluded: string[] = []) => poolState.rows.find((value) => !excluded.includes((value as { id: string }).id)) ?? null,
  decryptKey: async (row: { ciphertext: string }) => row.ciphertext,
  markKey: async (id: string, status: number) => { poolState.marked.push([id, status]); },
  reserveKey: vi.fn(),
}));

import { synthesize } from "@/lib/tts.server";

beforeEach(() => {
  poolState.error = null;
  poolState.rows = [];
  poolState.marked = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("provider API key errors", () => {
  it("explains that OpenRouter needs a key when saved keys cannot be loaded", async () => {
    poolState.error = new Error("Could not load OpenRouter keys from Supabase");

    await expect(synthesize({
      text: "Ciao, come stai?",
      lang: "it",
      provider: "openrouter",
    })).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("OpenRouter requires an API key"),
    });
    await expect(synthesize({
      text: "Ciao, come stai?",
      lang: "it",
      provider: "openrouter",
    })).rejects.not.toThrow("Supabase");
  });

  it("explains how to configure a key when no key is available", async () => {
    await expect(synthesize({
      text: "Ciao, come stai?",
      lang: "it",
      provider: "openrouter",
    })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("OPENROUTER_API_KEY"),
    });
  });

  it("calls OpenAI TTS with the configured key and returns MP3 audio", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesize({ text: "Bonjour", lang: "fr", provider: "openai", apiKey: "openai-test" });

    expect(result).toMatchObject({ provider: "openai", mime: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/audio/speech", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer openai-test" }),
    }));
  });

  it("calls ElevenLabs with a voice ID and returns MP3 audio", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesize({ text: "Ciao", lang: "it", provider: "elevenlabs", apiKey: "eleven-test", voice: "voice-id" });

    expect(result.provider).toBe("elevenlabs");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/text-to-speech/voice-id?");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ "xi-api-key": "eleven-test" });
  });

  it("wraps Gemini PCM as WAV and reports provider token usage", async () => {
    const encodedPcm = btoa(String.fromCharCode(0, 0, 1, 0));
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ inlineData: { data: encodedPcm, mimeType: "audio/pcm;rate=24000" } }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesize({ text: "Hola", lang: "es", provider: "gemini", apiKey: "gemini-test" });

    expect(result).toMatchObject({ provider: "gemini", mime: "audio/wav", usage: { inputTokens: 3, outputTokens: 4 } });
    expect(result.audio.byteLength).toBe(48);
  });

  it("fails over from a rate-limited provider to another healthy key", async () => {
    poolState.rows = [
      { id: "openai-row", service: "openai", ciphertext: "openai-test" },
      { id: "gemini-row", service: "gemini", ciphertext: "gemini-test" },
    ];
    const encodedPcm = btoa(String.fromCharCode(0, 0, 1, 0));
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input).includes("api.openai.com")
      ? Response.json({ error: "rate limit" }, { status: 429 })
      : Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: encodedPcm, mimeType: "audio/pcm;rate=24000" } }] } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesize({ text: "Ciao", lang: "it", provider: "auto" });

    expect(result.provider).toBe("gemini");
    expect(poolState.marked).toEqual([["openai-row", 429], ["gemini-row", 200]]);
  });

  it("translates once before Auto routing without penalizing the selected provider", async () => {
    poolState.rows = [{ id: "openai-row", service: "openai", ciphertext: "openai-test" }];
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input).includes("translate.googleapis.com")
      ? Response.json([[['Hola']]])
      : new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesize({ text: "Hello", lang: "en", targetLang: "es", provider: "auto" });

    expect(result).toMatchObject({ provider: "openai", text: "Hola", lang: "es" });
    expect(poolState.marked).toEqual([["openai-row", 200]]);
  });
});
