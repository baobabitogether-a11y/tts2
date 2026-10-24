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
