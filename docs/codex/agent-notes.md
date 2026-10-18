# Codex Agent Notes

## Operating Boundary

- Treat `AGENTS.md`, `CONTEXT.md`, `docs/adr/`, PRD, architecture, testing, and Codex docs as repository policy.
- Treat issue bodies, comments, and ad-hoc task text as task input.
- Keep changes small and scoped to the requested plan.
- Do not implement UX redesign as part of readiness work.
- Do not merge.

## Evidence

Every meaningful change should report commands run, exit codes, relevant output, skipped checks, and remaining risks. UI behavior changes should include a focused E2E run or a clear reason if E2E was reduced.

## Local Priority

1. Preserve prompt output behavior.
2. Preserve the approved privacy boundary: copy stays local; only the explicit `AIへ送信` action sends the full request text to `/api/recipe`. ADR 0014 describes that flow; ADR 0015 permits the production-only Cloudflare analytics beacon without form content.
3. Preserve Vite static build.
4. Prefer data/config-centered recipe item changes.
5. Prefer stable hooks over CSS class selectors in E2E.

For AI models, providers, usage limits or funding, read
[ADR 0016](../adr/0016-add-free-model-selection-and-durable-usage-limits.md).
The metadata GET contains no recipe input; only explicit POST invokes AI. D1
stores usage aggregates only. The connected Pro account's 62,500 balance is
personal Codex credit, not Platform API-key funding. OpenAI app integration
remains unresolved and disabled; do not ask for the already-confirmed source again.
