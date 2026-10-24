const params = {
  text: { type: "string", description: "Text to speak (max 5000 chars)" },
  lang: { type: "string", description: "Source language code, e.g. en, fr, it, he. Fish Audio speaks multilingual input and receives this language (or target_lang after translation) as its language hint.", example: "en" },
  target_lang: { type: "string", description: "Optional. If set, text is translated before speaking" },
  provider: { type: "string", enum: ["google", "lovable", "openrouter"], default: "google" },
  api_key: { type: "string", description: "OpenRouter API key (optional if server keys are configured)" },
  voice: {
    type: "string",
    description:
      "Voice name. google: ignored (single voice per language). lovable: Gemini voices — Kore (default), Puck, Charon, Fenrir, Aoede, and others. openrouter: provider-specific voice ID; Fish Audio defaults to b347db033a6549378b48d00acb0d06cd.",
  },
  speed: {
    type: "number",
    minimum: 0.25,
    maximum: 4,
    default: 1,
    description:
      "Speech rate multiplier (0.25–4). google: passed as ttsspeed. lovable: applied as a pacing instruction to the model. openrouter: passed as the audio speed parameter.",
  },
  options: {
    type: "object",
    additionalProperties: true,
    properties: {
      model: {
        type: "string",
        default: "fish-audio/s2.1-pro-free:free",
        description: "OpenRouter TTS model. Defaults to Fish Audio S2.1 Pro Free.",
      },
    },
    description:
      "Provider-specific fields (lovable and openrouter). OpenRouter defaults to Fish Audio S2.1 Pro Free and returns MP3 audio. For GET requests, pass as a URL-encoded JSON string.",
  },
  format: { type: "string", enum: ["binary", "json"], default: "binary", description: "binary = raw audio file, json = base64 audio" },
} as const;

export const openApiSpec = {
  openapi: "3.1.0",
  info: { title: "Speak API", version: "1.0.0", description: "Text-to-speech with optional translation. CORS enabled." },
  paths: {
    "/api/public/tts": {
      get: {
        summary: "Synthesize speech (query params)",
        parameters: Object.entries(params).map(([name, schema]) => ({
          name,
          in: "query",
          required: name === "text" || name === "lang",
          schema,
        })),
        responses: {
          "200": {
            description: "Encoded audio (audio/mpeg or audio/wav), or JSON when format=json",
            content: {
              "audio/mpeg": { schema: { type: "string", format: "binary" } },
              "audio/wav": { schema: { type: "string", format: "binary" } },
              "application/json": {
                schema: {
                  type: "object",
                  properties: { audio: { type: "string" }, mime: { type: "string" }, text: { type: "string" }, lang: { type: "string" } },
                },
              },
            },
          },
          "400": { description: "Invalid input" },
        },
      },
      post: {
        summary: "Synthesize speech (JSON body)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["text", "lang"], properties: params } } },
        },
        responses: { "200": { description: "Same as GET" } },
      },
    },
  },
};
