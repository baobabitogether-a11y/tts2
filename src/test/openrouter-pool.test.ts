import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

const durable = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  userRows: [] as Array<Record<string, unknown>>,
  markedUserRows: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const rows = table === "user_provider_api_keys" ? durable.userRows : durable.rows;
      const filters: Record<string, unknown> = {};
      const query = {
        insert: async (row: Record<string, unknown>) => {
          rows.push({
            ...row,
            id: "independent-row-id",
            status: table === "user_provider_api_keys" ? "unknown" : "blocked",
            failures: table === "user_provider_api_keys" ? 0 : 3,
            code: table === "user_provider_api_keys" ? null : 401,
            quarantined_until: null,
            created_at: new Date().toISOString(),
            last_used: null,
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
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        order: async () => ({
          data: rows.filter((row) =>
            Object.entries(filters).every(([key, value]) => row[key] === value),
          ),
          error: null,
        }),
        maybeSingle: async () => ({
          data:
            rows.find((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value),
            ) ?? null,
          error: null,
        }),
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "mark_user_provider_key") durable.markedUserRows.push(args);
      return { error: null };
    },
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
  vi.stubEnv("DEEPGRAM_API_KEY", "");
  durable.rows.length = 0;
  durable.userRows.length = 0;
  durable.markedUserRows.length = 0;
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

  it("returns only a last-four suffix and useful initial status for personal keys", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    const secret = "synthetic-openrouter-key-1234";
    await pool.addUserKey("owner-1", "openrouter", secret);

    const [listed] = await pool.listUserKeys("owner-1");

    expect(listed).toMatchObject({
      service: "openrouter",
      key_suffix: "1234",
      status: "untested",
    });
    expect(JSON.stringify(listed)).not.toContain(secret);
    expect(listed).not.toHaveProperty("ciphertext");
    expect(listed).not.toHaveProperty("fingerprint");
  });

  it("tests personal OpenRouter keys and returns safe account/token status", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    const secret = "synthetic-openrouter-key-test";
    await pool.addUserKey("owner-1", "openrouter", secret);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${secret}`);
      return Response.json({
        data: {
          label: "test key",
          limit: 10,
          limit_remaining: 8,
          usage: 2,
          is_free_tier: false,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pool.testUserProviderKey("owner-1", "independent-row-id");

    expect(result).toMatchObject({
      valid: true,
      status: "valid",
      account: { label: "test key", limit: 10, limit_remaining: 8, usage: 2 },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(durable.markedUserRows).toEqual([
      { owner_id: "owner-1", key_id: "independent-row-id", response_code: 200 },
    ]);
  });

  it("does not return OpenRouter error response bodies or credentials", async () => {
    const pool = await import("@/lib/openrouter-pool.server");
    const secret = "synthetic-invalid-openrouter-key";
    await pool.addUserKey("owner-1", "openrouter", secret);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: `Rejected ${secret}` }, { status: 401 })),
    );

    const result = await pool.testUserProviderKey("owner-1", "independent-row-id");

    expect(result).toMatchObject({ valid: false, status: "invalid", http_status: 401 });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("Rejected");
  });

  it.each([
    ["lovable", "https://ai.gateway.lovable.dev/v1/models", "Authorization", "Bearer"],
    ["gemini", "https://generativelanguage.googleapis.com/v1beta/models", "x-goog-api-key", ""],
    ["openai", "https://api.openai.com/v1/models", "Authorization", "Bearer"],
    ["elevenlabs", "https://api.elevenlabs.io/v1/user", "xi-api-key", ""],
    ["deepgram", "https://api.deepgram.com/v1/projects", "Authorization", "Token"],
  ] as const)(
    "tests saved %s keys without exposing credentials in request URLs",
    async (service, endpoint, header, scheme) => {
      const pool = await import("@/lib/openrouter-pool.server");
      const secret = `synthetic-${service}-key`;
      await pool.addUserKey("owner-1", service, secret);
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(endpoint);
        expect(new Headers(init?.headers).get(header)).toBe(
          scheme ? `${scheme} ${secret}` : secret,
        );
        return new Response(null, { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await pool.testUserProviderKey("owner-1", "independent-row-id");

      expect(result).toMatchObject({
        valid: true,
        status: "valid",
        service,
        message: `${service} accepted this API key.`,
      });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(durable.markedUserRows).toEqual([
        { owner_id: "owner-1", key_id: "independent-row-id", response_code: 200 },
      ]);
    },
  );
});
