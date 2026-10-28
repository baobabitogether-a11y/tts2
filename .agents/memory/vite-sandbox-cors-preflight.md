---
name: Vite sandbox CORS preflight
description: Replit preview behavior for OPTIONS requests intercepted by the Vite dev server.
---

In the Replit preview, Vite's development middleware can answer CORS `OPTIONS` requests before TanStack Start route handlers run. The middleware's allow-origin behavior can differ from route-level CORS headers, especially for external origins. Confirm route-level CORS headers on a non-preflight request and test preflight through the actual deployed runtime separately.

**Why:** The preview's preflight response differed from the API handler's `Access-Control-Allow-Origin: *` headers, so an OPTIONS check against the local dev server alone can misrepresent the app's production CORS behavior.

**How to apply:** When testing API CORS in Replit preview, include realistic `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers` headers. Treat the dev-server preflight response and the app's route response as distinct checks.
