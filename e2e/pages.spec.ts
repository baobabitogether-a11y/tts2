import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", heading: "speak/api" },
  { path: "/account", heading: "Your Speak API account" },
  { path: "/docs", heading: "Speak API API reference" },
  { path: "/openrouter", heading: "Provider keys" },
  { path: "/reports", heading: "Usage reports" },
  { path: "/page-that-does-not-exist", heading: "Page not found", notFound: true },
] as const satisfies Array<{ path: string; heading: string; notFound?: boolean }>;

function trackBrowserErrors(page: import("@playwright/test").Page, allowNotFound = false) {
  const errors: string[] = [];
  const origin = new URL(process.env["PLAYWRIGHT_BASE_URL"] || "http://127.0.0.1:4173").origin;
  page.on("pageerror", (error) => errors.push(`Uncaught exception: ${error.message}`));
  page.on("console", (message) => {
    const expectedNotFoundDocument =
      allowNotFound &&
      message.type() === "error" &&
      /^Failed to load resource: the server responded with a status of (?:a )?404(?: \([^)]*\))?$/.test(
        message.text(),
      );
    if (message.type() === "error" && !expectedNotFoundDocument) {
      errors.push(`Console error: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === origin) {
      errors.push(
        `Failed request: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
      );
    }
  });
  page.on("response", (response) => {
    const expectedNotFound =
      allowNotFound &&
      response.status() === 404 &&
      response.request().isNavigationRequest() &&
      response.request().resourceType() === "document";
    if (
      !expectedNotFound &&
      new URL(response.url()).origin === origin &&
      response.status() >= 400
    ) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

for (const { path, heading, notFound } of pages) {
  test(`${path} renders without browser errors`, async ({ page }) => {
    const errors = trackBrowserErrors(page, notFound);
    await page.route("https://openrouter.ai/api/frontend/v1/models/find**", (route) =>
      route.fulfill({ json: { data: { models: [] } } }),
    );

    const response = await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (notFound) {
      expect(response?.status(), `${path} document response`).toBe(404);
    } else {
      expect(response?.status(), `${path} document response`).toBeLessThan(400);
    }
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (notFound) {
      await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("main")).toBeVisible();
    }
    if (path === "/account") {
      if (process.env["PLAYWRIGHT_SUPABASE_CONFIGURED"] === "true") {
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();
      } else {
        await expect(page.getByRole("alert")).toContainText("Account features require Supabase");
      }
    }
    if (path === "/") {
      await expect(page.getByRole("option", { name: "Deepgram Aura" })).toBeAttached();
    }
    if (path === "/docs") {
      await expect(page.getByText("Synthesize speech (JSON body)", { exact: true })).toBeAttached();
    }
    if (path === "/openrouter") {
      await expect(page.getByRole("option", { name: "Deepgram" })).toBeAttached();
    }

    expect(errors, `${path} browser errors`).toEqual([]);
  });
}

test("main navigation links reach the API reference and account page", async ({ page }) => {
  const errors = trackBrowserErrors(page);
  await page.route("https://openrouter.ai/api/frontend/v1/models/find**", (route) =>
    route.fulfill({ json: { data: { models: [] } } }),
  );

  await page.goto("/");
  await page.getByRole("link", { name: "API reference" }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: "Speak API API reference" })).toBeVisible();
  await page.getByRole("link", { name: "Back to speech" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Create account / manage keys" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your Speak API account" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, "navigation browser errors").toEqual([]);
});

test("account shows full Auth API errors to the user", async ({ page }) => {
  let signupRequestUrl = "";
  await page.route("**/auth/v1/signup", (route) =>
    (async () => {
      signupRequestUrl = route.request().url();
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "gateway_not_found", message: "Auth route not found" }),
      });
    })(),
  );

  await page.goto("/account");
  await page.getByLabel("Email").fill("signup-error@example.test");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText('"status": 404');
  await expect(alert).toContainText("gateway_not_found");
  await expect(alert).toContainText("Auth route not found");
  await expect(alert).toContainText("/auth/v1/signup");
  expect(new URL(signupRequestUrl).origin).toBe(
    new URL(
      process.env["PLAYWRIGHT_SUPABASE_URL"] ||
        process.env["PLAYWRIGHT_BASE_URL"] ||
        "http://127.0.0.1:4173",
    ).origin,
  );
});

test("account shows a masked OpenRouter key and its tested status", async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: "test-user-id",
      aud: "authenticated",
      role: "authenticated",
      exp: now + 3600,
    }),
  ).toString("base64url");
  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.test-signature`;
  const user = {
    id: "test-user-id",
    email: "key-owner@example.test",
    aud: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  let testStatus: "valid" | "invalid" = "valid";
  let testAuthorization = "";

  await page.route("**/auth/v1/signup", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "test-refresh-token",
        user,
      }),
    }),
  );
  await page.route("**/api/user/provider-keys", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          services: ["openrouter"],
          keys: [
            {
              id: "independent-row-id",
              service: "openrouter",
              key_suffix: "9xY2",
              status: testStatus,
              failures: 0,
              code: null,
              created_at: new Date().toISOString(),
              last_used: null,
            },
          ],
        },
      });
      return;
    }

    testAuthorization = route.request().headers()["authorization"] ?? "";
    expect(route.request().postDataJSON()).toEqual({ test: true, id: "independent-row-id" });
    await route.fulfill(
      testStatus === "valid"
        ? { json: { test: { status: "valid", account: { limit: 100, usage: 2 } } } }
        : {
            json: {
              test: { valid: false, status: "invalid", message: "OpenRouter rejected this key." },
            },
          },
    );
  });
  await page.route("**/api/user/token", (route) => route.fulfill({ json: { tokens: [] } }));
  await page.route("**/api/public/usage?hours=168", (route) =>
    route.fulfill({
      json: {
        window_hours: 168,
        totals: {
          requests: 0,
          successful: 0,
          failed: 0,
          input_chars: 0,
          output_chars: 0,
          estimated_input_tokens: 0,
          provider_input_tokens: 0,
          provider_output_tokens: 0,
        },
      },
    }),
  );

  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByLabel("openrouter key suffix")).toHaveText("••••9xY2");
  await page.getByRole("button", { name: "Test key" }).click();
  const result = page.getByRole("status");
  await expect(result).toContainText("valid — limit: 100 · usage: 2");
  await expect(result).toHaveClass(/text-green-700/);
  testStatus = "invalid";
  await page.getByRole("button", { name: "Test key" }).click();
  await expect(result).toContainText("invalid — OpenRouter rejected this key.");
  await expect(result).toHaveClass(/text-red-700/);
  expect(testAuthorization).toBe(`Bearer ${accessToken}`);
});

test("Auto selection remains available after no-key synthesis failure", async ({ page }) => {
  await page.route("**/api/public/tts", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "No provider key is available for Auto routing. Add a key in account settings.",
      }),
    }),
  );
  await page.route("https://openrouter.ai/api/frontend/v1/models/find**", (route) =>
    route.fulfill({ json: { data: { models: [] } } }),
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Provider").selectOption("auto");
  await page.getByRole("button", { name: "Generate audio" }).click();

  await expect(page.getByRole("alert")).toContainText("No provider key is available");
  await expect(
    page.getByRole("link", { name: "Add a provider key in your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Provider")).toHaveValue("auto");
  await expect(page.getByLabel("Provider").getByRole("option", { name: /Auto/ })).toBeAttached();
});

test("docs API tester sends a personal token only as a bearer header", async ({ page }) => {
  const token = "spk_test-token-never-render";
  let authorization = "";
  let requestUrl = "";
  await page.route("**/api/public/tts", async (route) => {
    authorization = route.request().headers()["authorization"] ?? "";
    requestUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.from([1, 2, 3]) });
  });
  await page.goto("/docs");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Personal API token").fill(token);
  await page.getByLabel("Tester text").fill("Test voice");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByRole("status")).toContainText("audio/mpeg");
  await expect(page.locator("audio")).toBeVisible();
  expect(authorization).toBe(`Bearer ${token}`);
  expect(requestUrl).not.toContain(token);
  await expect(page.locator("body")).not.toContainText(token);
});

test("server-backed status, history, and OpenAPI endpoints respond successfully", async ({
  request,
}) => {
  const health = await request.get("/health");
  expect(health.status(), "/health").toBe(200);
  await expect(health.json()).resolves.toMatchObject({ status: "ok" });

  const history = await request.get("/history");
  expect(history.status(), "/history").toBe(200);
  const historyBody = await history.json();
  expect(historyBody.count).toEqual(expect.any(Number));
  expect(Array.isArray(historyBody.requests)).toBe(true);

  const openapi = await request.get("/api/public/openapi.json");
  expect(openapi.status(), "/api/public/openapi.json").toBe(200);
  await expect(openapi.json()).resolves.toMatchObject({ openapi: "3.1.0" });
});

test("account APIs respond appropriately for the Supabase configuration", async ({ request }) => {
  const configured = process.env["PLAYWRIGHT_SUPABASE_CONFIGURED"] === "true";
  for (const [path, unavailableMessage] of [
    ["/api/user/provider-keys", "Account provider keys require Supabase."],
    ["/api/user/token", "Personal API tokens require Supabase."],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(configured ? 401 : 503);
    await expect(response.json()).resolves.toMatchObject({
      error: configured ? "Authentication required" : unavailableMessage,
    });
  }
});

test("unauthenticated public API routes return expected client errors", async ({ request }) => {
  const openKeys = await request.get("/api/public/openrouter-keys?service=deepgram");
  expect(openKeys.status(), "/api/public/openrouter-keys").toBe(401);

  const usage = await request.get("/api/public/usage");
  expect(usage.status(), "/api/public/usage").toBe(401);

  const preflight = await request.fetch("/api/public/tts", { method: "OPTIONS" });
  expect(preflight.status(), "TTS preflight").toBe(204);
});
