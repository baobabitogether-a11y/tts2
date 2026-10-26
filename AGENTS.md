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
- Keep provider-specific HTTP adapters in `src/lib/tts.server.ts`; do not expose provider credentials to browser code or log them.
- The canonical OpenAPI document is `src/lib/openapi.ts`, served at `/api/public/openapi.json`. Update its provider, request, response, and usage schemas when API behavior changes.
- Add database changes as ordered Drizzle SQL migrations, register each migration in `drizzle/migrations/meta/_journal.json`, and update `src/integrations/supabase/types.ts` for changed tables or RPCs.
- Auto routing uses configured keys and persisted health/quarantine state; it does not imply live provider credit-balance polling. Keep usage statistics grouped by the actual provider that served the request.
- Run `npm test`, `npm run build`, and `npx drizzle-kit check` before shipping. `npm run dev` starts the local app.
