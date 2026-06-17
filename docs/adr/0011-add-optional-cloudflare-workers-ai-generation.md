# Add Optional Cloudflare Workers AI Generation

The app now supports an optional in-app recipe proposal path in addition to the original copy/paste path.

This is an approved exception to ADR 0008 for the current feature scope. The core artifact remains the `レシピ依頼文`, and the copy flow remains a first-class path for users who want to use ChatGPT, Claude, Gemini, or another AI themselves. The in-app path sends the current `レシピ依頼文` to a same-origin Cloudflare Pages Function, which calls Workers AI through the `AI` binding.

Guardrails:

- Keep `buildPrompt(data)` as the source of truth for the recipe request text.
- Keep `AI向けレシピ依頼文をコピー` available before, during, and after in-app generation.
- Do not put Cloudflare API tokens, account IDs, or provider keys in browser source.
- Browser source may call only the same-origin `/api/recipe` endpoint for this feature.
- The Pages Function must use `context.env.AI.run(...)`, not Cloudflare REST from the browser.
- Do not add login, database persistence, telemetry, analytics, or external LLM auto-posting.
- Limit prompt length and model output tokens to protect the free/low-cost usage boundary.
- Sanitize API errors and do not log user prompt text.

This choice changes the privacy model for users who press `AIでレシピを作成`: their recipe request text is sent to Cloudflare Workers AI. Users who do not want that can continue to copy the request text and paste it into an AI service of their choice.
