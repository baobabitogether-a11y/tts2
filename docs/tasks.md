# Task ledger

Statuses describe repository evidence, not merely code presence:

- **Done**: implemented and verified at the stated scope.
- **Blocked**: the next verification step depends on an unavailable credential
  or environment capability; retain the evidence and resume when available.
- **Open**: not implemented or not yet verified.

Keep the prompt text below verbatim. Append new requests and update statuses
without silently rewriting prior prompt history. Do not record secrets.

## Active work

| Request                                                                      | Status      | Evidence / next step                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provide a browsable OpenAPI reference and keep the JSON contract accessible. | Done        | `/docs` is derived from `src/lib/openapi.ts`; `/api/public/openapi.json` and the page were smoke-tested over HTTP. Commit `07a77c0`.                                                                                                                                                                                                                                    |
| Implement roadmap work in reasonable priority order.                         | In progress | Added Deepgram Aura as a provider with language-based models, speed/output options, Auto routing, environment/shared/personal key support, account management, OpenAPI documentation, and migration `0005`. `37` tests, build, and Drizzle migration checks pass. Real audio still needs a Deepgram key; full Supabase remains blocked by Codespaces Docker networking. |
| Run the project using local Docker Supabase.                                 | Partial     | The full Supabase CLI is blocked by bridge networking. `./docker/manage.sh local-up` runs the app with Postgres, PostgREST, and GoTrue on host networking; migrations, API endpoints, GoTrue signup, and encrypted key persistence are verified. See [codespace.md](./codespace.md) for missing full-stack services and setup.                                          |
| Publish the completed commits to GitHub/Lovable.                             | Blocked     | Implementation commit `d94c36b` is local and `git push origin main` failed with `unable to get password from user`; `gh auth status` reports no authenticated GitHub host. Authenticate with `gh auth login`, then push `main`.                                                                                                                                         |
| Verify all HTML pages and browser runtime errors with Docker-backed E2E.     | Done        | All 14 Playwright checks pass against the rebuilt local Compose app: all HTML routes plus 404, navigation, browser errors, provider-key masking/testing, Auto no-key behavior, the `/docs` bearer-token flow, API responses, and expected auth behavior.                                                                                                                |
| Implement the saved-key, Auto, and `/docs` API tester backlog.               | Done        | Four reported flows are implemented and covered by 41 unit tests and 14 Docker-backed E2E tests. `npm run build`, `npx drizzle-kit check`, targeted ESLint/Prettier, and `git diff --check` pass. Full-repository lint and type-check still report unrelated existing issues; live OpenRouter credential validation was not run.                                        |

## Raw prompt history

### 1. Supabase environment error

```text
index-DKD7_udw.js:23 [Supabase] Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud.
Wh @ index-DKD7_udw.js:23
2index-DKD7_udw.js:23 Error: Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect https://tts2.lovable.app/account
shows:
# This page didn't load
Something went wrong on our end. You can try refreshing or head back home.

console error shows:
Supabase in Lovable Cloud.
    at Wh (index-DKD7_udw.js:23:61841)
    at Object.get (index-DKD7_udw.js:23:61995)
    at account-BNAXeDdT.js:1:809
    at Kc (index-DKD7_udw.js:9:91780)
    at jl (index-DKD7_udw.js:9:106901)
    at Al (index-DKD7_udw.js:9:106785)
    at jl (index-DKD7_udw.js:9:106881)
    at Al (index-DKD7_udw.js:9:106785)
    at jl (index-DKD7_udw.js:9:106881)
    at Al (index-DKD7_udw.js:9:106785)
```

**Status: Done.** The account route handles missing Supabase configuration without crashing; this was committed as `7ab36e0`.

### 2. Finalize and publish the Supabase error handling

```text
finalize. commit and push
```

**Status: Partially done.** The account crash fix was committed as `7ab36e0`; pushing remains blocked until GitHub credentials are available.

### 3. Supabase-independent version

```text
support a version which not relys on superbase
```

**Status: Done.** Public synthesis supports Google or server-configured provider keys without Supabase; persistent account features still need Supabase. Commit `81ad9c2`.

### 4. Finalize and publish the Supabase-independent version

```text
finilize, commit and push
```

**Status: Partially done.** Commit `81ad9c2` was created; pushing remains blocked until GitHub credentials are available.

### 5. Per-request provider key

```text
support passing api-key on the go (to override any superbases settings and to not rely on db)
```

**Status: Done.** `api_key` JSON and `X-Provider-API-Key` override saved/server keys for a selected keyed provider and are not stored. Commit `236b428`.

### 6. Finalize and publish per-request provider keys

```text
finilize.commit and push
```

**Status: Partially done.** Commit `236b428` was created; pushing remains blocked until GitHub credentials are available.

### 7. Lovable deployment

```text
can it now be deployed to lovable platform ?
```

**Status: Blocked.** Deployment sync requires pushing commits; GitHub credentials were unavailable in this environment.

### 8. Roadmap

```text
update according to roadmap.md
```

**Status: In progress.** Continue from the unchecked entries in [roadmap.md](../roadmap.md); maintain evidence-based completion status.

### 9. Local Supabase, API docs, and prioritized roadmap

```text
1. first - run the project using a local docker of superbase
2. AGENTS.md - ensure up-to-date openapi.json and accessible web interface of openapi
3. start implementing more features according to roadmap based on reasonable priority level
```

**Status: Partially done / blocked.** OpenAPI JSON and `/docs` are current and verified; tested roadmap items were updated. Full Supabase startup remains blocked by Codespace Docker bridge networking, and real provider audio requires configured credentials. Details: [codespace.md](./codespace.md).

### 10. Documentation guidance and task tracking

```text
1.
AGENTS.md -  manage docs/*.md such as docs/codespace.md - maintain knowledge based on mistake you have bumped into - should suggest avoiding those issues in the future.
-
2. docs/*.md - manage task managments including raw prompt history and statuses

3. go on.
```

**Status: Done.** Added this task ledger and Codespaces troubleshooting guidance. The broader roadmap remains in progress; continue its blocked local Supabase and synthesis verification when the required environment is available.

### 11. Continue roadmap work

```text
go on
```

**Status: In progress.** Tested whether Docker host-gateway forwarding could bypass the blocked bridge. The host gateway is reachable, but the Supabase migrator's `db` entry is in a Docker-managed read-only hosts file, so the CLI cannot use that route. The experimental CLI startup path fails at the same migrator step. Added the confirmed limitation to [codespace.md](./codespace.md); database migrations/RPCs remain verified against the disposable Supabase Postgres image. Full local Supabase and real provider audio remain blocked.

### 12. Continue

```text
go on.
```

**Status: In progress.** Retried the experimental Supabase CLI startup mode; it fails with the same Realtime migrator DB connection timeout. GitHub authentication is still unavailable. No new application changes are justified until local networking or external credentials are available; the tests and isolated database checks already pass.

### 13. Continue

```text
go on.
```

**Status: Done for API documentation coverage.** Auditing the public contract found that token-creation responses were nested under `requestBody`, token revocation was nested under the create operation, and the shared-key management and canonical OpenAPI routes were absent from the spec. Corrected the operation structure, documented shared-key management without returning secret fields, and added regression tests for route coverage, top-level operation responses, and security-sensitive response shapes. All 35 tests pass; the production build and `npx drizzle-kit check` pass. The dev HTTP smoke test confirms six API paths and 13 operations, each with a top-level responses object, and `/docs` renders the new operations. The production preview script itself is mismatched with this Cloudflare build output; see [codespace.md](./codespace.md). Full local Supabase and real provider audio remain blocked.

### 14. Continue

```text
go on.
```

**Status: Done for OpenAPI linter/security validation.** Redocly identified missing explicit security declarations on public operations and an incomplete description of usage authentication. Added `security: []` for unauthenticated TTS/spec operations and documented personal-token, Supabase-session, or management-bearer authentication for usage. Constrained shared-key POST input to require either `key` or `reset`. All 35 tests pass; Redocly validates the served contract with two advisory warnings (license not declared, and the always-successful spec endpoint has no 4xx response). Build validation is being rerun for this continuation. Full local Supabase and real provider audio remain blocked.

### 15. Continue

```text
go on.
```

**Status: Done for provider request-bound documentation.** Compared OpenAPI limits with the TTS route's Zod schema and documented the enforced text, language, target-language, API-key, voice, and GET-options limits, including the header API key limit. Added assertions to the OpenAPI tests. All 35 tests pass; ESLint, Prettier, production build, and Drizzle check pass. Redocly validates the served JSON with only the same two advisory warnings (the project has no declared license, so do not invent one, and the OpenAPI endpoint has no meaningful 4xx response). Full local Supabase, real provider audio, and GitHub publishing remain blocked.

### 16. Continue with Deepgram

```text
go on.
```

Scope confirmation:

```text
deepgram
```

**Status: Implemented and locally verified.** Added the Deepgram Aura TTS adapter using its documented REST endpoint and `Token` authorization, language-matched Aura-2 defaults for English, Spanish, German, Dutch, French, Italian, and Japanese, explicit model override, supported speed and output query options, and response MIME propagation. Added Deepgram to server environment keys, shared/personal key storage and management, Auto routing, playground choices, account UI, request validation, and all relevant OpenAPI schemas. Migration `0005` extends provider constraints and shared Auto reservation; it was executed against disposable PostgreSQL, including an Auto reservation check. `37` tests, production build, Drizzle checks, served `/docs` and OpenAPI smoke tests, and Redocly validation pass. Redocly retains two advisory warnings (undeclared license and no 4xx response for the public spec endpoint). The Deepgram HTTP request is mocked in tests; real synthesis requires a Deepgram API key. Full local Supabase remains blocked by Docker bridge networking.

### 17. Browser E2E and Docker setup

```text
use e2e to ensure no errors occure on any page.

use docker to get e2e setup:
https://github.com/mostuf25564/subtitle-sync/tree/main/docker
```

**Status: Done.** Added a pinned Playwright Docker runner, browser tests for all five HTML routes and the 404 page, navigation checks, and assertions against console errors, uncaught page exceptions, and failing same-origin requests. Added API smoke tests for health/history/OpenAPI, TTS CORS preflight, and expected unauthorized or Supabase-unavailable responses. `./docker/manage.sh e2e` passed all 10 tests. Tests mock optional OpenRouter model discovery and need no provider credentials or Supabase. Fixed Docker build-context/artifact paths, rebuilt the image on each run, and made Vite's optimizer cache writable for the non-root test user; see [codespace.md](./codespace.md).

### 18. Continue

```text
go on.
```

**Status: Blocked on external environment.** Confirmed the Docker daemon is available but has no running Supabase services. The remaining roadmap item is full local Supabase persistence/integration plus real multilingual provider audio; earlier attempts established that this Codespace cannot connect Docker bridge containers, and real synthesis needs a provider credential. The isolated Supabase Postgres migration/RPC checks, unit tests, and Docker browser E2E already pass. Avoid repeating the same CLI startup attempt unless Docker networking changes; see [codespace.md](./codespace.md).

### 19. Solve local Supabase startup

```text
solve it
```

**Status: Solved for the app's local DB/Auth/REST needs using a minimal stack.** The Supabase CLI remains blocked by Docker bridge networking, confirmed by a same-bridge Postgres probe and host firewall inspection permission failure. Implemented and started a project-specific host-network Compose stack with Postgres, PostgREST, GoTrue, API gateway, and the web app. Ordered migrations apply on startup and are idempotent on repeat; REST/Auth/OpenAPI/docs/health endpoints return success; actual GoTrue signup/admin cleanup and synthetic encrypted provider-key persistence passed. All 10 Playwright tests, 37 unit tests, production build, and Drizzle check pass. The minimal stack omits Studio, Storage, Realtime, and Edge Functions; see [codespace.md](./codespace.md).

### 20. Free disk space and continue

```text
1. due to disk space issue - get rid of unused / redundunt images and continue only ensuring u have enough space
```

**Status: Done.** Disk use was 95% with 1.6 GB available. Removed unused Supabase Studio, Storage, Realtime, Edge Runtime, Postgres Meta, Mailpit, Logflare, Vector, Kong, and the network-probe image; retained the images needed for the local Compose services and Playwright. Reclaimed about 6 GB; disk availability is now 6.9 GB (22% free).

### 21. Compose networking for local services and web

```text
u might use docker compose to set the network between all services including the web
```

**Status: Done with host networking.** A Compose bridge would still be subject to the proven bridge TCP failure, so configured the minimal local Supabase-compatible services and web app with Docker host networking, all bound to loopback. `./docker/manage.sh local-up` now generates ignored development secrets, starts services, and applies migrations; the running app and browser E2E checks were verified. See [README.md](../README.md) and [codespace.md](./codespace.md).

### 22. Finalize, commit, and push

```text
finilize then commit and push. ensuring any conclusions and solving issue or any remiaing issue must be stored on docs for farther dev and review
```

**Status: Committed locally; push blocked by unavailable authentication.** Commit `68d805c` contains the implementation and documentation. `git push origin main` failed with `fatal: unable to get password from user`; `gh auth status` reports no authenticated GitHub host. Authenticate with `gh auth login` and push `main` to publish it to GitHub/Lovable.

### 23. Codespaces forwarded URL returns 404

```text
https://dreadful-spooky-cemetery-9pr5x5969gr29xv9-9999.app.github.dev/

error 404
```

**Status: Local app verified; external access unresolved.** Port `9999` is GoTrue's internal Auth port and its root returns 404. Local app health returns HTTP 200, but both derived external URLs for ports `8080` and `54321` returned HTTP 404. GitHub CLI cannot inspect the forwarded-port list because this session lacks the `codespace` auth scope. A generated URL is not proof of forwarding; verify actual port state/browse URLs in the VS Code Ports panel. See the new verify-before-sharing guidance in [AGENTS.md](../AGENTS.md) and [codespace.md](./codespace.md).

### 24. Verify instructions before suggesting them

```text
why do instruct me to run into troubles? ensure checking before allowing / suggesting to run something
```

**Status: Guidance updated.** The app's local health was checked, but I mistakenly treated a derived Codespaces URL as useful advice without verifying its external route; the user-facing forwarded host returned HTTP 404, and this session cannot inspect port-forward state because GitHub CLI lacks Codespaces authorization. Added a project-wide rule to verify exact commands and public paths before recommending them, and to distinguish verified facts from prerequisites/unverified states. Startup now explicitly verifies local app health and identifies external port forwarding as unverified.

### 25. Run the project and verify Docker health

```text
try to run it yourself first ! ensuring docker health check
```

**Status: Done locally.** Ran `./docker/manage.sh local-up`; Compose waited for all five containers (Postgres, PostgREST, GoTrue, gateway, web) to report `healthy`, then Drizzle migrations applied. App, REST, and Auth HTTP checks all returned 200; all 10 browser E2E tests passed; 6.8 GB disk remains available. The Codespaces external forwarded URLs still return 404, so public browser access remains unverified until VS Code forwards the ports. A first PostgREST healthcheck implementation failed because the upstream shell-less image lacks BusyBox's dynamic loader; replaced it with a BusyBox runtime image carrying the PostgREST binary and documented the recovery in [codespace.md](./codespace.md).

### 26. Show full Auth errors to the client

```text
show full error to client!
```

**Status: Implemented and covered by E2E.** Account signup/signin failures now show structured error properties (name, message, status, code, details, hint, and cause when provided) and the Auth request URL; stack traces and request credentials are not exposed. The reported `https://<codespace>-54321.app.github.dev/auth/v1/signup` is on the public Auth endpoint. Direct probing of its `/auth/v1/health` returned an empty HTTP 404 from the Codespaces tunnel, even though local Auth and gateway checks returned 200. The browser-visible error should now clarify the failed public route; external forwarding itself still needs to be corrected/verified in the VS Code Ports panel.

### 27. Resolve browser Auth fetch failure

```text
{
  "name": "AuthRetryableFetchError",
  "message": "Failed to fetch",
  "status": 0,
  "request_url": "https://<codespace>-54321.app.github.dev/auth/v1/signup"
}
```

**Status: Implemented and verified.** The Codespaces tunnel returns an empty 404 for the public 54321 URL while local Auth is healthy, and the browser's status 0 confirms it received no HTTP response. Updated the local Codespaces client URL to use the app origin on port 8080 and configured Vite to proxy `/auth/v1` to the local gateway. Local `/auth/v1/health` through the app proxy returns 200, and all 11 browser E2E tests pass with an assertion that Auth requests use the configured app origin. Browser signup no longer requires separately forwarding port 54321 or issuing a cross-origin request. The public app URL redirects to Codespaces tunnel authentication from this shell (HTTP 302/401), so user browser access still requires a valid VS Code/Codespaces session and port 8080 forwarding.

### 28. Add a verified application startup script

```text
create a script ensuring app is up and running with use of the relevant ports
```

**Status: Implemented.** Added the root `./start.sh` entry point to start the Docker Compose app/database stack, apply migrations, then verify PostgreSQL TCP `5432`, API gateway `54321`, app `8080`, the same-origin Auth proxy, and all five Docker health statuses. In Codespaces it instructs the user to forward port `8080` in the Ports panel; external forwarding cannot be determined from the local service health checks.

### 29. Record OpenRouter, Auto, and API tester issues

```text
0. add todos: (manage it using your AGENTS.md aware docs, assuming all docs are at reach from AGENTS.md while keeping itself slim and effecient)

todos:
1. one can add openrouter key.
unfortunatly it then presented as:
OpenRouter
unknown
Remove
- more reasonable to show the last X key degits and have a button to test the key & token status.

2. and later try to use the system to generate voice but it fails with error:
OpenRouter requires an API key. Set OPENROUTER_API_KEY or OPENROUTER_API_KEYS, or add a saved provider key.

3. when setting the provider to auto :
- it also shows error for no available keys and then the option of auto is removed

4. i have generated an access-token key but the app doesnt provide a place to use it such as on /docs to be included withing requests issued from that api-testing page
```

**Status: Done.** Implemented all four items in [todos.md](./todos.md): masked OpenRouter key suffix and owner-scoped key testing, using account-saved OpenRouter keys for speech, retaining Auto with no-key guidance, and adding a memory-only bearer-token field to the `/docs` tester. The backlog itself was committed as `04e1729`.

### 30. Continue provider backlog implementation

```text
go on
```

**Status: Done.** The server only returns the last four characters of saved keys and allowlisted OpenRouter status fields; tests cover invalid, unavailable, and unreachable key-test outcomes without returning provider error bodies or secrets. Signed-in playground requests carry the session bearer token so the server can select the owner's encrypted key, and OpenRouter synthesis is covered with a mocked provider response. Auto remains selected after a no-key failure and offers a link to Account settings. The `/docs` tester sends an optional personal token only as an Authorization bearer header; the browser E2E verifies it is absent from the URL and rendered page. A dedicated E2E also verifies the account test-key action and masked suffix.

Verification: `npm test` (41 tests), `npm run build`, `npx drizzle-kit check`, targeted ESLint/Prettier, `git diff --check`, and all 14 Docker-backed Playwright tests pass. `./start.sh` rebuilt the local Docker app and verified Postgres, Supabase gateway/Auth, app health, and all five container healthchecks. The full-repository `npm run lint` and `npx tsc --noEmit` still fail on pre-existing issues in untouched files (lint formatting errors elsewhere; six TS4111 index-signature errors in `src/test/user-account.test.ts`). No live provider key was available for an external OpenRouter account check.

### 31. Continue local work after push failures

```text
AGENTS.md - never stop on git push failure - leave that to the developer and continue working on your left tasks
```

**Status: Done.** Added project guidance that a failed `git push` must not block other requested implementation or verification, and that authentication troubleshooting is left to the developer unless requested. Report unpublished commits clearly at completion.

### 32. Use clear colors for key validation

```text
minimal ui colors and style - think about it.
validate key - wont u show red/green ??
```

**Status: Done.** Key validation results now use restrained green text for valid keys and red text for invalid keys, while unavailable/unreachable states stay neutral. A browser regression verifies both success and rejection colors. `npm run build`, targeted ESLint/Prettier, and all 14 Docker-backed E2E tests pass.

### 33. Add key testing for every provider

```text
there should be a test-key option for any of the providers
```

**Status: Done.** The account now offers **Test key** on every saved keyed provider (Lovable, Gemini, OpenAI, ElevenLabs, Deepgram, and OpenRouter). The server uses each provider's non-billing authentication endpoint, sends credentials only in the expected authorization header, scopes lookups to the signed-in owner, and returns safe provider-specific status. Google remains excluded because its public TTS integration does not use a saved provider key. Verification: 46 unit tests, all 14 Docker-backed E2E tests, production build, Drizzle check, targeted ESLint/Prettier, and `git diff --check` pass. The browser test checks all six provider rows and their test action.
