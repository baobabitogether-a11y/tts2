# Product roadmap

Priorities are ordered by the remaining product value and readiness. A blocker
is a prerequisite, not a reason to repeat an already-failed environment probe.

## P1 — Verify real provider speech end to end

**Status: Blocked; production key/configuration is not healthy.**

- Restore a working provider key and resolve why production health marks the
  configured OpenRouter key blocked after HTTP 401 while synthesis reports
  HTTP 503.
- Confirm production serves the current API contract after the reported
  Lovable redeploy.
- Run real multilingual synthesis with a working provider key.
- Verify the actual provider, response time, MIME type, and returned audio in the
  app, including playback from browser history.
- Cover more than one provider where credentials are available; do not claim
  live provider behavior based only on mocked tests.

**Prerequisite:** a valid provider API key and outbound access to that provider.
No key is committed or required to be shared in the repository.

## P2 — Revisit full Supabase CLI integration testing

**Status: Blocked by this Codespace's Docker bridge networking; app needs are
covered by the verified minimal local stack.**

- Resume `supabase start` integration checks only after container-to-container
  TCP connectivity works or the Docker runtime/network policy changes.
- Do not repeat arbitrary subnet or host-gateway attempts; see
  [the verified Codespaces findings](docs/codespace.md).

**Already verified locally:** Postgres, PostgREST, GoTrue, gateway, and app
healthchecks; ordered Drizzle migrations; Auth signup; and encrypted provider
key persistence using a synthetic key. This is the project's minimal
host-network stack, not the complete Supabase CLI stack.

## Delivered

- [x] Restore a clean build after the latest provider edits and verify the app loads.

- Multilingual Fish Audio handling and language choices.
- Durable provider-key storage, AES-GCM encryption, rotation, failure tracking,
  quarantine, and server-verified key management.
- Deepgram Aura and provider-specific options alongside existing TTS providers.
- Saved-key testing, Auto routing, personal API tokens, and the `/docs` API
  tester.
- `/tokens` provider-key and personal-token activity, plus usage reports.
- Responsive navigation, mobile menu, persisted themes, and playable
  browser-local audio history with per-generation details.
