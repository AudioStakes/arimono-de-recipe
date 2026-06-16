# AI Gotchas

- Do not turn this into a recipe generation app. The output is a request text for the user to copy.
- Do not add `fetch`, `WebSocket`, `sendBeacon`, API keys, or provider SDKs to runtime source.
- Do not send form input outside the browser.
- Do not add unspecified recipe items or their rule text to the generated prompt.
- Do not move prompt section rules into UI rendering code.
- Do not treat CSS classes as stable E2E contracts.
- Do not add package exports or workspaces unless they solve a real current problem.
- Do not weaken tests to make a PR pass.
- Do not merge a Codex-created PR.
