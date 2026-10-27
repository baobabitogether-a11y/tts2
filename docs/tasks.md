# Current task status

This is the short, current-state view. Do not load the historical prompt archive
for routine work; use [the docs index](./README.md) to open only the topic needed.
Preserve original prompts and detailed completion evidence in
[task-history.md](./task-history.md).

| Area | Status | Current note |
|---|---|---|
| Product roadmap | In progress | See [roadmap.md](../roadmap.md) for prioritized remaining work. |
| Local app, Auth, REST, and database | Verified minimal stack | `./docker/manage.sh local-up` verifies healthchecks and migrations. Full Supabase CLI startup is blocked by Docker bridge TCP; see [codespace.md](./codespace.md) only for local-stack work. |
| Real provider synthesis | Needs credentials | Live multilingual output remains unverified without a valid provider API key. |
| OpenAPI and `/docs` | Done | Contract is maintained in `src/lib/openapi.ts`. |
| Saved provider keys, Auto routing, and API tester | Done | Details and constraints are in [todos.md](./todos.md); read it when changing those features. |
| `/tokens` provider-key and personal-token activity | Done | Service-role-backed history avoids storing credentials or provider response bodies. |
| Responsive shell and themes | Done | Mobile navigation and System/Light/Dark themes are implemented. |
| Playable audio history | Done | Successful playground audio is kept in browser-local IndexedDB (100 records / 50 MB) and listed on `/reports`. |
| Provider key failure diagnostics | Done | API errors now explain likely causes by HTTP status, summarize attempted keys, include short sanitized provider error detail, and explicitly distinguish HTTP 5xx outages from invalid credentials. |
| Remaining end-to-end validation | Blocked on external prerequisites | Source is synced to `origin/main`; hosted Lovable still serves the old API contract. Live provider verification needs a configured provider credential; full Supabase CLI startup needs Docker bridge TCP. The minimal local stack is healthy and its migrations/Auth/key persistence are verified. |
| GitHub publishing | Synced | Verified `main` and `origin/main` both point to `bc197ed`. The most recent documentation update is local and not yet pushed. |
| Hosted provider diagnostics | Deployment pending | Production `/api/public/openapi.json` still says “All eligible provider keys failed,” while the local app serves the improved 503 explanation. Trigger or await the connected Lovable deployment, then recheck the published contract. |
| Documentation efficiency | Done | Frequent guidance and task status are concise; archives and environment/backlog references are routed by topic in [README.md](./README.md). |

## Current documentation task

**Done:** Detailed prompt history is archived separately; the docs index links
directly to relevant Codespaces sections and marks backlog/history as optional.

## Recording future tasks

- Add one concise current-state row above when work changes status.
- Preserve full user wording and detailed verification evidence in
  [task-history.md](./task-history.md), not this file.
- For backlog implementation status, update [todos.md](./todos.md) only when
  relevant; for priorities, update [roadmap.md](../roadmap.md).
