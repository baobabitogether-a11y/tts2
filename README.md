# Tts2

create a fullstack app. on the frontend be minimalistic and expose an open-api interface. the backend should send back the encoded audio file.

Enable CORS on all backend endpoints (handling OPTIONS preflight, Access-Control-Allow-Origin: *, headers, and methods so external clients can call it).

on the backend create an endpoint to fetch audio based on:

- text
- lang
- target lang (utilize translation if target lang is specified)
- service provider name (`auto`, Google, Lovable, OpenRouter, Gemini, OpenAI, ElevenLabs, or Deepgram Aura)
- optional provider API key

For keyed providers, keys can be supplied in the request, stored in the encrypted provider-key pool, or configured through environment variables. Auto randomly selects a configured key that is not currently marked blocked/quarantined, and tries another key/provider after authentication, quota, or availability failures. Exact credit balances are provider-specific and are not polled by Auto.

For Google: use the Google translation mechanism if target lang is specified, and fetch audio via https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl={lang}&q={text}.

Extend it with the Lovable TTS option as well.

## Provider keys and usage

Environment variables accept one key or a comma/whitespace-separated key list:

- `OPENROUTER_API_KEY` / `OPENROUTER_API_KEYS`
- `LOVABLE_API_KEY` / `LOVABLE_API_KEYS`
- `GEMINI_API_KEY` / `GEMINI_API_KEYS`
- `OPENAI_API_KEY` / `OPENAI_API_KEYS`
- `ELEVENLABS_API_KEY` / `ELEVENLABS_API_KEYS`
- `DEEPGRAM_API_KEY` / `DEEPGRAM_API_KEYS`

Saved keys require `OPENROUTER_KEY_ENCRYPTION_SECRET`. Protect key management and the JSON usage endpoint with `PROVIDER_MANAGEMENT_TOKEN` (or the legacy `OPENROUTER_MANAGEMENT_TOKEN`). The report endpoint is `GET /api/public/usage?hours=24`; it returns JSON grouped by the provider that actually served each request, with character counts, estimated and provider-reported tokens, audio bytes, cache hits, and latency.

Deepgram uses an Aura-2 voice matching English, Spanish, German, Dutch, French, Italian, or Japanese when possible; other languages default to English. Supply an Aura model ID with `options.model` or `voice` to override the default. Deepgram supports the shared `speed` setting and output options such as `encoding`, `container`, `sample_rate`, `bit_rate`, and `mip_opt_out`.

### Run without Supabase

Public synthesis can run without Supabase. Google TTS works without credentials; other providers and `auto` routing use server-configured provider keys from the environment variables above. In this mode keys are not saved or health-tracked, and `auto` retries configured keys for the current request only.

Account sign-in, personal API tokens, saved provider keys, and persistent usage reports require Supabase. Recent request history remains available at `/history` for the current server instance only.

## Using the API from an external agent

Give the agent these endpoints:

- OpenAPI contract: `https://tts2.lovable.app/api/public/openapi.json`
- Speech request: `POST https://tts2.lovable.app/api/public/tts`

Suggested agent instruction:

> Use the Speak API OpenAPI contract at `https://tts2.lovable.app/api/public/openapi.json`. To generate speech, POST JSON to `/api/public/tts` with `text` and `lang`. Use `provider: "auto"` to select among configured healthy keyed providers; if Auto reports that no provider key is configured, use `provider: "google"` or ask the service owner to configure provider keys. Add `target_lang` only when translation is requested. The default response is audio bytes; play or save them using the returned Content-Type. Read `X-Provider` to identify the provider. Use `format: "json"` when you need a JSON response containing base64 audio and response metadata. Never ask the user for server secrets or call `/api/public/usage` unless the owner supplied an authorized management bearer token.

Example request:

```http
POST /api/public/tts HTTP/1.1
Host: tts2.lovable.app
Content-Type: application/json

{"text":"Ciao, come stai?","lang":"it","provider":"auto"}
```

To use your own provider key for just one request, select the matching provider and send `api_key` in the POST JSON body, or send it in the `X-Provider-API-Key` header. This per-request key takes precedence over saved and server-configured keys and is not stored. Do not combine a one-request key with `provider: "auto"`; Auto cannot determine which provider the key belongs to. Avoid putting keys in GET query strings because URLs may be logged.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tts2.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/050d4f04-2fad-4330-ac5f-be0031c4e4db).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Browser end-to-end tests

The Playwright suite visits every HTML page and fails on browser console errors
or uncaught page exceptions. It also checks the public status/history/OpenAPI
endpoints and the expected Supabase-unavailable responses. Provider calls are
mocked; these checks do not require provider credentials or a Supabase stack.

Run the pinned Playwright browser environment in Docker:

```sh
./docker/manage.sh e2e
```

Test results and the HTML report are written under `docker/artifacts/`. To run
the suite directly, install Playwright's Chromium browser with
`npx playwright install chromium`, then use `npm run test:e2e`.

### Local Supabase in Docker

Start the app with a local Postgres, PostgREST, and Auth stack:

```sh
./docker/manage.sh local-up
```

The command generates gitignored local credentials in `.env.local-supabase`,
starts the Compose services, applies the Drizzle migrations, and serves the app
at `http://127.0.0.1:8080`. This Codespace blocks TCP between Docker bridge
containers, so these services use host networking and bind to loopback instead.
This intentionally minimal stack does not include Supabase Studio, Storage,
Realtime, or Edge Functions. Use `./docker/manage.sh local-down` to stop it;
the database volume is retained. To remove the database and all local data,
run `./docker/manage.sh local-down --volumes`.

In Codespaces, `local-up` verifies health on local ports `8080` and `54321`, but
cannot verify the Codespaces proxy or whether ports are forwarded. Use the
VS Code Ports panel and open its forwarded URL for port `8080`; forward `54321`
as well for browser sign-in. Do not treat the URL generated in
`.env.local-supabase` as proof that the external URL is live. The server-side
app and database continue to use loopback URLs.
