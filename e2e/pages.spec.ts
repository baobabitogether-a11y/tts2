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
      await expect(page.getByRole("alert")).toContainText("Account features require Supabase");
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

test("unconfigured account APIs return documented service-unavailable responses", async ({
  request,
}) => {
  for (const [path, expected] of [
    ["/api/user/provider-keys", "Account provider keys require Supabase."],
    ["/api/user/token", "Personal API tokens require Supabase."],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expected });
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
