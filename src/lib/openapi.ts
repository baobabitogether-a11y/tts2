const params = {
  text: { type: "string", description: "Text to speak (max 5000 chars)" },
  lang: { type: "string", description: "Source language as a YouTube-supported language code or BCP-47 tag (for example en, zh-Hant, es-419, or pt-BR). Language codes are passed through to the selected provider.", example: "en" },
  target_lang: { type: "string", description: "Optional YouTube-supported language code or BCP-47 tag. If set, text is translated before speaking.", example: "fr-CA" },
  provider: { type: "string", enum: ["auto", "google", "lovable", "openrouter", "gemini", "openai", "elevenlabs", "deepgram", "azure", "googlecloud"], default: "google", description: "Auto randomly selects a configured provider key without recent auth/quota failures. Providers are Google, Lovable, OpenRouter, Gemini, OpenAI, ElevenLabs, Deepgram, Azure Speech, and Google Cloud TTS." },
  api_key: { type: "string", description: "API key for the selected keyed provider. Omit to use server-configured keys for public requests. Personal API tokens must omit this field and use account-owned keys. Prefer POST over GET when supplying a key to avoid URL logging." },
  voice: {
    type: "string",
    description:
      "Provider-specific voice. Gemini: prebuilt voice name (default Kore). OpenAI: voice name (default coral). ElevenLabs: voice ID (default JBFqnCBsd6RMkjVDRZzb). OpenRouter: provider-specific voice ID; Fish Audio chooses a licensed voice matching lang when available. Auto ignores this field.",
  },
  speed: {
    type: "number",
    minimum: 0.25,
    maximum: 4,
    default: 1,
    description:
      "Speech rate multiplier (0.25–4). Supported directly by Google, OpenAI, and OpenRouter; other providers may clamp or ignore it.",
  },
  options: {
    type: "object",
    additionalProperties: true,
    properties: {
      model: {
        type: "string",
        default: "fish-audio/s2.1-pro-free:free",
        description: "Provider-specific model override. OpenRouter defaults to Fish Audio S2.1 Pro Free; OpenAI to gpt-4o-mini-tts; Gemini to gemini-2.5-flash-preview-tts; ElevenLabs to eleven_multilingual_v2.",
      },
      instructions: { type: "string", description: "Optional OpenAI speech style instructions." },
      voice_id: { type: "string", description: "Optional ElevenLabs voice ID override." },
    },
    description: "Provider-specific settings. For GET requests, pass as a URL-encoded JSON string.",
  },
  format: { type: "string", enum: ["binary", "json"], default: "binary", description: "binary = raw audio file, json = base64 audio" },
} as const;

const audioSuccessResponse = {
  description: "Encoded audio, or a JSON object when format=json. Auto selects a keyed provider without recent auth/quota failures; Google is not included because it does not use API keys.",
  headers: {
    "X-Provider": { schema: { type: "string", enum: ["google", "lovable", "openrouter", "gemini", "openai", "elevenlabs", "deepgram", "azure", "googlecloud"] }, description: "Provider that generated the audio, including the provider selected by Auto." },
  },
  content: {
    "audio/mpeg": { schema: { type: "string", format: "binary" } },
    "audio/wav": { schema: { type: "string", format: "binary" } },
    "application/json": {
      schema: {
        type: "object",
        properties: {
          audio: { type: "string", contentEncoding: "base64" },
          mime: { type: "string" },
          text: { type: "string" },
          lang: { type: "string" },
          provider: { type: "string" },
          usage: {
            type: "object",
            properties: { inputTokens: { type: "integer" }, outputTokens: { type: "integer" } },
          },
        },
      },
    },
  },
};

const usageMetricsSchema = {
  type: "object",
  properties: {
    requests: { type: "integer" },
    successful: { type: "integer" },
    failed: { type: "integer" },
    cached: { type: "integer" },
    audio_bytes: { type: "integer" },
    input_chars: { type: "integer" },
    output_chars: { type: "integer" },
    estimated_input_tokens: { type: "integer" },
    provider_input_tokens: { type: "integer", description: "Provider-reported total; zero when unavailable." },
    provider_output_tokens: { type: "integer", description: "Provider-reported total; zero when unavailable." },
    avg_duration_ms: { type: "integer" },
  },
};

const usageReportSchema = {
  type: "object",
  properties: {
    window_hours: { type: "integer" },
    totals: usageMetricsSchema,
    services: {
      type: "array",
      items: {
        type: "object",
        properties: { service: { type: "string" }, ...usageMetricsSchema.properties },
      },
    },
  },
};

export const openApiSpec = {
  openapi: "3.1.0",
  info: { title: "Speak API", version: "1.0.0", description: "Text-to-speech with optional translation. CORS enabled." },
  servers: [{ url: "https://tts2.lovable.app", description: "Speak API production server" }],
  paths: {
    "/api/public/tts": {
      get: {
        operationId: "synthesizeSpeechFromQuery",
        summary: "Synthesize speech (query params)",
        parameters: Object.entries(params).map(([name, schema]) => ({
          name,
          in: "query",
          required: name === "text" || name === "lang",
          schema: name === "options" ? { type: "string", description: "URL-encoded JSON object of provider options." } : schema,
        })),
        responses: {
          "200": audioSuccessResponse,
          "400": { description: "Invalid input or no configured provider key is available", content: { "application/json": { schema: { type: "object", properties: { error: {} } } } } },
          "502": { description: "All eligible provider keys failed" },
          "503": { description: "Provider key storage or routing is unavailable" },
        },
      },
      post: {
        operationId: "synthesizeSpeech",
        summary: "Synthesize speech (JSON body)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["text", "lang"], properties: params } } },
        },
        responses: {
          "200": audioSuccessResponse,
          "400": { description: "Invalid input or no configured provider key is available" },
          "502": { description: "All eligible provider keys failed" },
          "503": { description: "Provider key storage or routing is unavailable" },
        },
      },
    },
    "/api/public/usage": {
      get: {
        operationId: "getProviderUsageReport",
        summary: "Get provider usage statistics",
        description: "Returns parsable JSON aggregates by actual provider. Personal API tokens and Supabase sessions receive only their own usage; management credentials receive global usage.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "hours", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 720, default: 24 } }],
        responses: {
          "200": { description: "Request, audio, character, estimated-token, reported-token, and latency totals grouped by actual provider.", content: { "application/json": { schema: usageReportSchema } } },
          "401": { description: "Management authorization required" },
          "503": { description: "Usage report unavailable" },
        },
      },
    },
    "/api/user/token": {
      get: {
        operationId: "listPersonalApiTokens",
        summary: "List personal API tokens",
        security: [{ supabaseSessionAuth: [] }],
        responses: {
          "200": { description: "Token metadata only; token secrets are never returned by this operation.", content: { "application/json": { schema: { type: "object", properties: { tokens: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, label: { type: "string" }, created_at: { type: "string", format: "date-time" }, last_used: { type: ["string", "null"], format: "date-time" }, revoked_at: { type: ["string", "null"], format: "date-time" } } } } } } } },
          "401": { description: "Valid Supabase session required" },
        },
      },
      post: {
        operationId: "createPersonalApiToken",
        summary: "Create a personal API token",
        description: "Requires a Supabase session. The personal token secret is returned once and cannot be retrieved later; only its hash is stored.",
        security: [{ supabaseSessionAuth: [] }],
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { label: { type: "string", maxLength: 80, default: "External agent" } } } } },
        responses: {
          "201": { description: "New token. Store the token value securely; it is shown only once.", content: { "application/json": { schema: { type: "object", required: ["id", "token"], properties: { id: { type: "string", format: "uuid" }, token: { type: "string", description: "Personal bearer secret; shown once." } } } } } },
          "401": { description: "Valid Supabase session required" },
        },
      },
      delete: {
        operationId: "revokePersonalApiToken",
        summary: "Revoke a personal API token",
        security: [{ supabaseSessionAuth: [] }],
        parameters: [{ name: "id", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Token revoked" }, "404": { description: "Token not found for this user" }, "401": { description: "Valid Supabase session required" } },
      },
    },
    "/api/user/provider-keys": {
      get: {
        operationId: "listPersonalProviderKeys",
        summary: "List personal provider keys",
        security: [{ supabaseSessionAuth: [] }],
        responses: {
          "200": { description: "Owner-scoped key metadata. Provider secrets and ciphertext are never returned.", content: { "application/json": { schema: { type: "object", properties: { services: { type: "array", items: { type: "string", enum: ["openrouter", "lovable", "gemini", "openai", "elevenlabs", "deepgram", "azure", "googlecloud"] } }, keys: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, service: { type: "string" }, status: { type: "string" }, failures: { type: "integer" }, code: { type: ["integer", "null"] }, created_at: { type: "string", format: "date-time" }, last_used: { type: ["string", "null"], format: "date-time" } } } } } } } },
          "401": { description: "Valid Supabase session required" },
        },
      },
      post: {
        operationId: "savePersonalProviderKey",
        summary: "Save a personal provider key",
        security: [{ supabaseSessionAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["service", "key"], properties: { service: { type: "string", enum: ["openrouter", "lovable", "gemini", "openai", "elevenlabs", "deepgram", "azure", "googlecloud"] }, key: { type: "string", maxLength: 500 } } } } },
        responses: { "201": { description: "Provider key saved and encrypted" }, "409": { description: "Key already saved for this account" }, "401": { description: "Valid Supabase session required" } },
      },
      delete: {
        operationId: "removePersonalProviderKey",
        summary: "Remove a personal provider key",
        security: [{ supabaseSessionAuth: [] }],
        parameters: [{ name: "id", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Provider key removed" }, "404": { description: "Key not found for this user" }, "401": { description: "Valid Supabase session required" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "PROVIDER_MANAGEMENT_TOKEN or an authorized configured provider API key." },
      supabaseSessionAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Supabase access token from the signed-in user's session. Required for account management endpoints." },
    },
  },
};
