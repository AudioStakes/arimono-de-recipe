# AI Gotchas

- Keep prompt copy directly available before, during and after AI submission. ADR 0014 makes full-prompt submission the primary action and copy the alternative; the request text remains a first-class artifact.
- The approved in-app AI path is limited to `src/ai-recipe-client.ts` calling same-origin `/api/recipe` and `functions/api/recipe.ts` calling `context.env.AI.run(...)`.
- Do not add other `fetch`, `WebSocket`, `sendBeacon`, API keys, or provider SDKs to runtime source.
- ADR 0015 permits `src/web-analytics.ts` to install the standard Cloudflare beacon only on the exact production origin. Keep custom events and recipe input out of analytics, and avoid Pages automatic injection alongside it.
- Do not send form input anywhere except the approved `/api/recipe` path when the user presses `AIへ送信`.
- Render AI answers only through the safe Markdown boundary; do not enable raw HTML, image output or non-HTTP(S) links.
- Do not add unspecified recipe items or their rule text to the generated prompt.
- Do not move prompt section rules into UI rendering code.
- Do not treat CSS classes as stable E2E contracts.
- Do not add package exports or workspaces unless they solve a real current problem.
- Do not weaken tests to make a PR pass.
- Do not merge a Codex-created PR.
