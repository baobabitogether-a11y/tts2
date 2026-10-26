# Task ledger

Statuses describe repository evidence, not merely code presence:

- **Done**: implemented and verified at the stated scope.
- **Blocked**: the next verification step depends on an unavailable credential
  or environment capability; retain the evidence and resume when available.
- **Open**: not implemented or not yet verified.

Keep the prompt text below verbatim. Append new requests and update statuses
without silently rewriting prior prompt history. Do not record secrets.

## Active work

| Request                                                                      | Status      | Evidence / next step                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provide a browsable OpenAPI reference and keep the JSON contract accessible. | Done        | `/docs` is derived from `src/lib/openapi.ts`; `/api/public/openapi.json` and the page were smoke-tested over HTTP. Commit `07a77c0`.                                                                                                                                                                 |
| Implement roadmap work in reasonable priority order.                         | In progress | Multilingual Fish Audio and persistent encrypted provider-key features are implemented. The five ordered Drizzle migrations and key-pool RPC behavior passed against the Supabase Postgres image; `32` tests pass. Remaining full-stack and real-audio checks are blocked.                           |
| Run the project using local Docker Supabase.                                 | Blocked     | CLI startup times out in the temporary Realtime migrator because Docker bridge peer TCP is unavailable in this Codespace. Regular, database-only, experimental, and host-network startup attempts did not work; published host-port Postgres connectivity works. See [codespace.md](./codespace.md). |
| Publish the completed commits to GitHub/Lovable.                             | Blocked     | `git push` failed because Git could not obtain credentials; `gh auth status` reports no authenticated GitHub host. Commits since the last push remain local. Authenticate and run `git push` to resume.                                                                                              |

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
