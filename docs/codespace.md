# Codespaces and local Supabase

This note records environment behavior that was actually observed in the project
Codespace. Recheck it when the Docker daemon, Supabase CLI, or runtime image
changes; do not assume every developer has the same network restrictions.

## Local Supabase startup

The Supabase CLI is `2.122.0` in the environment where these notes were
confirmed. `npx supabase start`, including `--exclude realtime,...`, fails
during `Initialising schema...`: the CLI starts a temporary Realtime migration
container, which resolves the Postgres service name but times out opening
Postgres TCP port `5432`. The Postgres container reports healthy and listens on
`0.0.0.0:5432`, but that does not prove that the migration container can reach
it.
The CLI's `--experimental` startup mode and `supabase db start` hit the same
temporary-migrator failure; excluding the long-lived Realtime service does not
skip the schema migration.

The same limitation was reproduced with a separate Postgres container and a
probe container on both the default bridge subnet and a separate
`192.168.241.0/24` bridge. In contrast, a Postgres container's published port
was reachable from the Codespace host. Treat this as a Docker bridge networking
limitation in this environment, not evidence that the app's Supabase
configuration is wrong.

### Diagnose before retrying

1. Capture the startup log and inspect the temporary migrator while it is still
   running. Check service DNS (`getent hosts db`) and TCP connectivity
   (`pg_isready -h db -p 5432 -t 2`); DNS resolution and container health alone
   are insufficient.
2. Check whether a separate container on the same bridge can reach a disposable
   Postgres instance. If that also times out, avoid repeatedly retrying the
   Supabase CLI without changing the Docker networking or runtime.
3. `npx supabase db start` uses the same schema-initialization path and does not
   avoid the temporary Realtime migrator.
4. `npx supabase start --network-id host` is not a workaround here: the CLI
   requires network-scoped aliases, which Docker's built-in `host` network
   does not support.
5. A bridge container can connect through the Docker host gateway to a
   published Postgres port when `host.docker.internal` is explicitly mapped.
   This is useful for isolated migration and SQL/RPC checks, but does **not**
   make the Supabase Auth/REST stack or end-to-end app integration available.
6. This host-gateway probe does not unblock the Supabase CLI: its temporary
   Realtime migrator connects to the hostname `db`, and Docker manages the
   migrator's `/etc/hosts` as a read-only mount. `docker exec` cannot edit it,
   and `docker cp` cannot replace it (`device or resource busy`). Do not try to
   redirect the CLI this way unless its container supports an explicit
   `--add-host` mapping.
7. Trying a different non-overlapping bridge subnet did not restore
   container-to-container TCP. Do not spend time repeating the probe with more
   arbitrary subnets unless the Docker daemon/network policy changes.

Do not silently edit Supabase configuration or claim a full local stack is
running to work around this host-level limitation. Resume full-stack testing
when Docker bridge connectivity works or use an explicitly configured local
Supabase environment.

## Disposable migration checks

The official Supabase Postgres image can be used to validate ordered Drizzle
migrations and database functions in isolation:

- Wait for the container's health status to become `healthy`; the initial
  `pg_isready` success can occur during image initialization, before its
  initialization script has shut down the bootstrap server.
- Use the `supabase_admin` role for Supabase-owned schemas. The `postgres` role
  is not a superuser in this image, and `auth` is owned by `supabase_admin`.
- On a pristine image, PostgreSQL GraphQL DDL event triggers can reference a
  schema version sequence that has not been initialized. Disabling those
  triggers is acceptable only inside a disposable migration-test database; do
  not apply that workaround to a real Supabase project.
- Apply migrations in lexical order and use `psql -v ON_ERROR_STOP=1`.
  Exercise the important RPCs and grants, not just migration syntax.
- Use synthetic keys only and delete only the explicitly named temporary
  containers and networks created by the check.

This verifies the SQL and RPC behavior, not persistence across a Supabase
service restart, PostgREST/Auth integration, or provider audio synthesis.
Real synthesis requires a deliberately configured provider credential; never
print or commit one.

## Project commands

```sh
npx supabase start
npm run dev
npm test
npm run build
npx drizzle-kit check
```

The CLI's generated `supabase/.temp/` state is ignored by Git. Do not commit it.

## HTTP smoke tests and production preview

`npm run dev -- --host 127.0.0.1` was verified to serve the app, `/docs`, and
`/api/public/openapi.json`. Use it for local HTTP smoke checks in this
Codespace.

`npm run build` succeeds and emits the Nitro/Cloudflare worker under `.output/`.
However, `npm run preview` (`vite preview`) currently fails because the
TanStack preview plugin looks for `dist/server/server.js`, which this build
does not produce. Do not treat that preview error as an application route
failure or repeatedly retry the same command. Production artifact runtime
verification needs a preview command that targets the configured Cloudflare
output; until then, report build validation and dev-server HTTP validation
separately.

## Browser end-to-end tests

Run the Playwright browser suite in the pinned official browser container:

```sh
./docker/manage.sh e2e
```

The Playwright container starts the Vite app and browser in the same container,
so this test does not depend on Docker bridge connectivity to another app
container or the host. Docker Compose build contexts and bind mounts are
resolved relative to the configured project directory in this setup; with
`--project-directory` at the repository root, use `context: .`,
`dockerfile: docker/Dockerfile`, and an explicit repository-root-relative
artifact path. When the test process runs as the Playwright image's non-root
user, ensure `/workspace/node_modules/.vite` is writable; `npm ci` creates the
directory as root, and Vite's optimizer otherwise fails to write its cache.
The Docker runner must build the image before `compose run` so Dockerfile
permission fixes and test-source changes are not silently tested with a stale
image.
