import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

const durable = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        durable.rows.push({
          ...row,
          id: "independent-row-id",
          status: "blocked",
          failures: 3,
          code: 401,
          quarantined_until: null,
        });
        return { error: null };
      },
      upsert: async (rows: Array<Record<string, unknown>>) => {
        durable.rows.push(
          ...rows.map((row) => ({
            ...row,
            id: "environment-row-id",
            status: "unknown",
            failures: 0,
            code: null,
            quarantined_until: null,
          })),
        );
        return { error: null };
      },
      select: () => ({ order: async () => ({ data: durable.rows, error: null }) }),
    }),
  },
}));
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubEnv("OPENROUTER_KEY_ENCRYPTION_SECRET", "test-encryption-only-not-a-provider-credential");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEYS", "");
  vi.stubEnv("PROVIDER_MANAGEMENT_TOKEN", "");
  vi.stubEnv("OPENROUTER_MANAGEMENT_TOKEN", "");
  vi.stubEnv("LOVABLE_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  durable.rows.length = 0;
});
describe("durable key storage", () => {
  it("reads the saved key and status after all pool modules are reloaded", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    await pool.addKey("synthetic-test-value");
    expect(durable.rows[0]?.["ciphertext"]).not.toContain("synthetic-test-value");
    vi.resetModules();
    const reloaded = await import("@/lib/openrouter-pool.server");
    const rows = await reloaded.poolRows();
    const first = rows[0];
    if (!first) throw new Error("Saved key was lost");
    expect(await reloaded.decryptKey(first)).toBe("synthetic-test-value");
    const publicResponse = reloaded.publicKey(first);
    expect(publicResponse).toMatchObject({
      id: "independent-row-id",
      status: "blocked",
      failures: 3,
      code: 401,
    });
    expect(publicResponse).not.toHaveProperty("fingerprint");
    expect(publicResponse).not.toHaveProperty("ciphertext");
    expect(JSON.stringify(publicResponse)).not.toContain("synthetic-test-value");
  });
  it("adds OPENROUTER_API_KEY to the encrypted server pool", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-server-openrouter-key");
    const pool = await import("@/lib/openrouter-pool.server");

    const rows = await pool.poolRows();
    const configuredKey = rows[0];
    if (!configuredKey) throw new Error("Environment key was not added to the pool");
    expect(configuredKey.source).toBe("env");
    expect(configuredKey.ciphertext).not.toContain("synthetic-server-openrouter-key");
    expect(await pool.decryptKey(configuredKey)).toBe("synthetic-server-openrouter-key");
  });
  it("authorizes only the configured management token or a configured provider key", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    vi.stubEnv("PROVIDER_MANAGEMENT_TOKEN", "synthetic-management-token");
    expect(
      await pool.authorizeManagement(
        new Request("http://localhost", {
          headers: { Authorization: "Bearer synthetic-management-token" },
        }),
      ),
    ).toBe(true);
    expect(
      await pool.authorizeManagement(
        new Request("http://localhost", {
          headers: { Authorization: "Bearer incorrect-token" },
        }),
      ),
    ).toBe(false);

    vi.stubEnv("PROVIDER_MANAGEMENT_TOKEN", "");
    vi.stubEnv("GEMINI_API_KEY", "synthetic-configured-provider-key");
    expect(
      await pool.authorizeManagement(
        new Request("http://localhost", {
          headers: { Authorization: "Bearer synthetic-configured-provider-key" },
        }),
      ),
    ).toBe(true);
  });
  it("rejects key management without a server-verified token", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    expect(await pool.authorizeManagement(new Request("http://localhost"))).toBe(false);
  });
});
