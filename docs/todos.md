# Product backlog

These are user-reported product issues. Keep implementation status and
verification evidence in [the task ledger](./tasks.md). All four items below
are implemented and verified; retain this record as completed backlog history.

## Provider keys and API testing

### 1. Show useful saved-key status and test keys — Done

- Replace `unknown` in the OpenRouter saved-key row with a masked suffix (last
  four characters only); never return or render the full secret after save.
- Add an explicit **Test key** action that safely validates the saved key with
  OpenRouter and displays the result and available token/credit status when the
  provider returns it. Distinguish invalid credentials, unavailable status
  information, and provider/network failures.
- Keep secrets encrypted at rest; do not put keys in URLs, browser logs, or
  server logs. Test response shapes and key-redaction behavior.

### 2. Use saved OpenRouter keys for speech generation — Done

- Resolve the signed-in user's saved OpenRouter key for OpenRouter speech
  requests when no per-request key is supplied.
- Preserve precedence: explicit per-request key, then the user's saved key,
  then server-configured keys. Do not require a separate environment key when
  the user already has a valid saved key.
- Add coverage for resolution, adapter authorization, and safe errors when no
  usable key exists. Verify a successful mocked OpenRouter synthesis request.

### 3. Keep Auto available when no provider keys are usable — Done

- Do not remove or reset the `auto` provider selection after a failed request
  or a no-available-keys response.
- Keep Auto selectable and show a useful error explaining that no configured,
  healthy provider key is available, with guidance for configuring one.
- Add UI regression tests for selection persistence and the no-key state.

### 4. Use personal access tokens in the `/docs` API tester — Done

- Add an authorization input to the interactive API tester so a user can paste
  a personal access token and apply it to eligible requests as a bearer token.
- Make clear that the token is held only in the current browser session unless
  the user explicitly opts into persistence; never include it in URLs or logs.
- Verify authenticated API calls succeed, unauthenticated calls retain current
  behavior, and token values are redacted from errors and telemetry.
