<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Persist the shared OpenRouter key pool, rotation cursor and failure/quarantine state in service-role-only Cloud tables; workers restart and cannot own durable state.
- Encrypt saved provider keys with AES-GCM and use independent row IDs in responses; credentials and derived identifiers must not leak.
- Verify key-management calls server-side with a management bearer token or configured environment provider key; public synthesis remains available by design.

## Development notes

- Docs index: [task history](docs/tasks.md) (append verbatim requests/status), [product backlog](docs/todos.md) (open todos), [roadmap](roadmap.md) (planned features), and [Codespaces guide](docs/codespace.md) (verified environment behavior). Keep this file as concise cross-cutting guidance; do not duplicate document contents here.
- Maintain project development guidance and task records in `docs/*.md`. Add reusable, actionable lessons when a workflow hits a reproducible mistake or environment limitation; document the symptom, confirmed cause, recovery or workaround, and what future work should avoid. Do not record credentials, provider keys, session-only secrets, or guesses as facts.
- Before instructing someone to run a command, open a URL, or change environment/port settings, inspect the current project and environment and verify the exact command or target whenever possible. Check the real service/route and external path, not just a local process or generated URL. If access, authentication, UI state, or host policy prevents verification, state precisely what was verified, what remains unverified, and the prerequisite; never present a guessed URL or assumed state as working.
- If `git push` fails, do not let the publishing failure stop or block the remaining requested work. Do not spend time retrying or troubleshooting authentication unless asked; continue with local work and verification, then report that the commit is local and the developer must resolve publishing.
- Keep `docs/tasks.md` as the task ledger: preserve user prompts verbatim, track each request's status, and update the status and evidence when work is completed, blocked, or resumed. Add new prompts rather than silently rewriting history.
- Keep `docs/codespace.md` current with verified Codespaces, Docker, and local-Supabase setup behavior. Distinguish environment-specific blockers from application defects and record tested workarounds.
- Keep provider-specific HTTP adapters in `src/lib/tts.server.ts`; do not expose provider credentials to browser code or log them.
- The canonical OpenAPI document is `src/lib/openapi.ts`, served at `/api/public/openapi.json`. Update its provider, request, response, and usage schemas when API behavior changes.
- Keep every API route represented in OpenAPI. Each operation must have `responses` as a sibling of `requestBody`; add tests for operation structure and security-sensitive response shapes because valid JSON alone does not establish a valid OpenAPI contract.
- Keep the browsable API reference at `/docs` generated from that canonical OpenAPI object; link it from the speech playground and keep `/api/public/openapi.json` available for tools.
- Maintain browser end-to-end coverage in `e2e/` for every HTML route. E2E checks should fail on uncaught page exceptions and browser `console.error`; mock optional third-party calls rather than depending on provider credentials. Run `./docker/manage.sh e2e` for the pinned Playwright Docker environment.
- Add database changes as ordered Drizzle SQL migrations, register each migration in `drizzle/migrations/meta/_journal.json`, and update `src/integrations/supabase/types.ts` for changed tables or RPCs.
- Auto routing uses configured keys and persisted health/quarantine state; it does not imply live provider credit-balance polling. Keep usage statistics grouped by the actual provider that served the request.
- On a Docker host with working bridge networking, run `npx supabase start` and `npm run dev`. In this Codespace, use `./docker/manage.sh local-up` for the host-network Compose stack (Postgres, PostgREST, Auth, and app); it creates ignored local secrets, waits for Docker healthchecks on every service, and applies Drizzle migrations. The minimal stack omits Studio, Storage, Realtime, and Edge Functions. Use `./docker/manage.sh local-down` to stop it.
- Run `npm test`, `npm run test:e2e`, `npm run build`, and `npx drizzle-kit check` before shipping. Prefer the Docker-backed E2E runner when validating browser behavior.
