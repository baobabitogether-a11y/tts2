const params = {
  text: { type: "string", description: "Text to speak (max 5000 chars)" },
  lang: { type: "string", description: "Source language code, e.g. en", example: "en" },
  target_lang: { type: "string", description: "Optional. If set, text is translated before speaking" },
  provider: { type: "string", enum: ["google", "lovable", "openrouter"], default: "google" },
  api_key: { type: "string", description: "OpenRouter API key (optional if server keys are configured)" },
  voice: { type: "string", description: "Optional voice (lovable: Kore, Puck...; openrouter: alloy, nova...)" },
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
