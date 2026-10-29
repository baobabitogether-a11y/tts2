# Running on Replit

This is the imported React / TanStack Start application. Keep its existing
structure and stack.

- Runtime: Node.js 22 (the existing TanStack and Supabase packages require it).
- Click **Run** to start the `Start application` workflow (`npm run dev`).
- Vite listens on `0.0.0.0:5000` and accepts Replit's preview proxy hosts.
- The same server serves the frontend and API; use relative URLs.
- The speech playground is at `/`, API documentation at `/docs`, and the
  OpenAPI contract at `/api/public/openapi.json`. Status is at `/health`.

## Optional services

Google speech generation works without credentials. No Supabase instance or
paid-provider keys are configured by this setup. Select **Google** in the
playground; Auto needs configured provider keys.

Supabase is needed for sign-in, personal API tokens, saved provider keys, and
persistent usage reports. Server request history is otherwise in-memory.
The existing README documents provider environment variables. Store any
credentials in Replit Secrets, never in source code.

Do not use `start.sh` or the Docker setup on Replit; those instructions target
the original local/Codespaces environment.

## Checks

- `npm test`
- `npx tsc --noEmit`
- `npx drizzle-kit check` (checks migration metadata; does not connect or migrate)
- `npm run build` (preserves the repository's existing Cloudflare build target;
  publishing on Replit would require separately configuring a Node build target)
- `npm run test:e2e` uses the existing Playwright configuration. Set
  `PLAYWRIGHT_BASE_URL` to test a running server. Two account interaction tests
  require a configured Supabase client; they cannot run in no-Supabase mode.

## Verified import setup

The Replit runtime is configured for Node.js 22 and dependencies are installed.
The existing port-5000 workflow and Vite proxy-host configuration are retained.
Verified the playground visually in preview, `/health` through the Replit
development URL, and a real Google synthesis request returning MPEG audio.
All 55 unit tests, TypeScript checks, migration metadata checks, and the
existing Cloudflare-targeted build pass. The Playwright browser suite was not
run; account interactions remain unverified without Supabase.
