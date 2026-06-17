# UI Boundaries And Testability

## Boundaries

- UI shell renders the page frame and stable surfaces.
- Form rendering creates recipe item controls from data/config.
- Event binding updates state and delegates prompt refresh.
- Prompt generation stays in prompt/domain-oriented modules.
- Data definitions hold recipe item definitions, candidate values, and output labels.

Prompt output rules must not be scattered into visual rendering code. UX changes should not require rewriting prompt-building logic unless that behavior change is explicitly scoped.

## Stable Hooks

Stable hooks live near behavior and are independent from styling. CSS classes are for styling, not E2E behavior contracts.

- Use `data-testid` for behavior-critical selectors.
- Use `data-state="open|closed"` for collapsible fields and the mobile prompt panel.
- Keep existing `id` and ARIA attributes when code relies on them.
- Keep visible-text assertions where copy or accessibility is the behavior under test.

## Source Boundaries

This repo is currently a private single Vite app. It uses source-module boundaries instead of package exports:

- `src/data.ts` defines current recipe item and candidate relationships.
- `src/prompt.ts` owns prompt output rules.
- `src/ui.ts` owns rendering structure and stable hooks.
- `src/app-events.ts` owns interaction state changes.
- `src/ai-recipe-client.ts` owns the browser call to the same-origin `/api/recipe` endpoint.
- `src/ai-recipe-panel.ts` owns in-app AI generation UI state and keeps generated recipe text separate from prompt text.
- `src/recipe-decision/` owns the typed recipe-decision view model and adapters that keep the new decision flow separate from prompt-generation output.
- `functions/api/recipe.ts` owns the approved Cloudflare Pages Function boundary for Workers AI.

Do not add fake root `exports` just to make this app look like a package. If future `packages/*` are introduced, each package must declare explicit `exports` and avoid exposing broad internals.

## Future Component Splits

Any future split should preserve behavior first and styling second. Start with characterization tests around prompt output and E2E stable hooks, then move code in small steps.
