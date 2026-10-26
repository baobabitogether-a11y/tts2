import { describe, expect, it } from "vitest";
import { openApiSpec } from "@/lib/openapi";

describe("public OpenAPI specification", () => {
  it("documents every TTS provider and the provider returned by Auto", () => {
    const provider = openApiSpec.paths["/api/public/tts"].post.requestBody.content["application/json"].schema.properties.provider;

    expect(provider.enum).toEqual(["auto", "google", "lovable", "openrouter", "gemini", "openai", "elevenlabs"]);
    expect(openApiSpec.paths["/api/public/tts"].get.responses["200"].headers["X-Provider"]).toBeDefined();
    expect(openApiSpec.servers[0]?.url).toBe("https://tts2.lovable.app");
    expect(openApiSpec.paths["/api/public/tts"].post.operationId).toBe("synthesizeSpeech");
  });

  it("documents authenticated machine-readable usage aggregates", () => {
    const usage = openApiSpec.paths["/api/public/usage"].get;
    const report = usage.responses["200"].content["application/json"].schema;

    expect(usage.security).toEqual([{ bearerAuth: [] }]);
    expect(report.properties.totals.properties.input_chars).toBeDefined();
    expect(report.properties.totals.properties.provider_output_tokens).toBeDefined();
    expect(report.properties.services.items.properties.service).toBeDefined();
  });

  it("serializes as valid JSON for the openapi.json route", () => {
    expect(() => JSON.parse(JSON.stringify(openApiSpec))).not.toThrow();
  });
});
