# Tts2

create a fullstack app. on the frontend be minimalistic and expose an open-api interface. the backend should send back the encoded audio file.

Enable CORS on all backend endpoints (handling OPTIONS preflight, Access-Control-Allow-Origin: *, headers, and methods so external clients can call it).

on the backend create an endpoint to fetch audio based on:
- text
- lang
- target lang (utilize translation if target lang is specified)
- service provider name (`auto`, Google, Lovable, OpenRouter, Gemini, OpenAI, or ElevenLabs)
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

Saved keys require `OPENROUTER_KEY_ENCRYPTION_SECRET`. Protect key management and the JSON usage endpoint with `PROVIDER_MANAGEMENT_TOKEN` (or the legacy `OPENROUTER_MANAGEMENT_TOKEN`). The report endpoint is `GET /api/public/usage?hours=24`; it returns JSON grouped by the provider that actually served each request, with character counts, estimated and provider-reported tokens, audio bytes, cache hits, and latency.

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
