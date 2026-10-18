# Tts2

create a fullstack app. on the frontend be minimalistic and expose an open-api interface. the backend should send back the encoded audio file.

Enable CORS on all backend endpoints (handling OPTIONS preflight, Access-Control-Allow-Origin: *, headers, and methods so external clients can call it).

on the backend create an endpoint to fetch audio based on:
- text
- lang
- target lang (utilize translation if target lang is specified)
- service provider name (google / lovable / openrouter)
- api key (in case of openrouter)

For OpenRouter: allow providing an API key in the request and also allow configuring in advance a list of OpenRouter API keys to round-robin between them (probe them in serial order; in case one of them is blocked, move it to the end of the list and continue probing until a response is satisfied).

For Google: use the Google translation mechanism if target lang is specified, and fetch audio via https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl={lang}&q={text}.

Extend it with the Lovable TTS option as well.

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
