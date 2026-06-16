# Keep Static Client-Only Prompt Maker

The app remains a static client-only prompt maker. It renders a form, builds recipe request text in the browser, and lets the user copy that text into an AI tool.

We keep this boundary because the product promise depends on local input handling and a simple Cloudflare Pages `dist/` deployment. Adding server processing, API calls, login, storage, telemetry, or external transmission would change the privacy and architecture model.

Guardrails:

- Do not add API, server, auth, external sending, persistence, analytics, or telemetry without explicit human approval.
- Do not make the app generate recipes directly.
- Keep prompt-building behavior in client-side TypeScript modules.
- Keep deployment compatible with Vite static output.
