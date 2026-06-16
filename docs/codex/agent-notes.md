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
2. Preserve static-only privacy model.
3. Preserve Vite static build.
4. Prefer data/config-centered recipe item changes.
5. Prefer stable hooks over CSS class selectors in E2E.
