# AI Gotchas

- Do not remove or demote the AI向けレシピ依頼文 copy path. The request text remains a first-class artifact.
- The approved in-app AI path is limited to `src/ai-recipe-client.ts` calling same-origin `/api/recipe` and `functions/api/recipe.ts` calling `context.env.AI.run(...)`.
- Do not add other `fetch`, `WebSocket`, `sendBeacon`, API keys, or provider SDKs to runtime source.
- Do not send form input anywhere except the approved `/api/recipe` path when the user presses `AIでレシピを作成`.
- Do not add unspecified recipe items or their rule text to the generated prompt.
- Do not move prompt section rules into UI rendering code.
- Do not treat CSS classes as stable E2E contracts.
- Do not add package exports or workspaces unless they solve a real current problem.
- Do not weaken tests to make a PR pass.
- Do not merge a Codex-created PR.
