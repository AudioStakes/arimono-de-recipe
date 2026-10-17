# UI Boundaries And Testability

## Boundaries

- UI shell renders the page frame and stable surfaces.
- Form rendering creates recipe item controls from data/config.
- Browser events translate drafts and native controls into typed application operations.
- The application owns committed recipe requests, effective prompt data and AI state.
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

This repo is a public single Vite app. It uses source-module boundaries instead of package exports:

- `src/data.ts` defines current recipe item and candidate relationships.
- `src/prompt.ts` owns prompt output rules.
- `src/ui.ts` owns rendering structure and stable hooks.
- `src/recipe-application.ts` owns committed recipe requests and the AI lifecycle. Its
  typed operations, detached snapshots and subscriptions work in Node without a DOM.
  It derives effective data through `conditions.ts` and reuses `buildPrompt`.
- `src/combo-options.ts` owns candidate ordering; `suggestions.ts` filters the existing catalog.
- `src/combo-registry.ts` owns browser drafts, IME and candidate/pill focus. It delegates
  committed values to the application instead of keeping a second value array.
- `src/serving-controls.ts` projects application counts; DOM datasets do not own counts.
- `src/app-events.ts` owns presentation interactions, dialogs and action adapters.
- `src/ai-recipe-client.ts` owns the browser call to the same-origin `/api/recipe` endpoint.
- `src/web-analytics.ts` owns the approved production-only Cloudflare Web Analytics script installation; it does not read form state.
- `src/ai-prompt-panel.ts` renders answer state and handles explicit send focus. It
  reports Markdown rendering failures back to the application without mutating its
  snapshot. Async completion does not move focus or scroll. Unchanged answer state
  is not repainted while native input/change/click events are in progress.
- `src/output-panel.ts` copies the application prompt through the browser Clipboard
  adapter and retains manual recovery. Copy/submit commit eligible drafts synchronously.
- `src/recipe-markdown.ts` owns safe answer presentation only; it does not build the request or validate ingredients.
- `src/recipe-decision/materials.ts` retains material amount validation; candidate adapters and cooking-view state have been removed under ADR 0014.
- `functions/api/recipe.ts` owns the approved Cloudflare Pages Function boundary for Workers AI.

Do not add fake root `exports` just to make this app look like a package. If future `packages/*` are introduced, each package must declare explicit `exports` and avoid exposing broad internals.

## Future Component Splits

Any future split should preserve behavior first and styling second. Start with characterization tests around prompt output and E2E stable hooks, then move code in small steps.

The [UI migration map](ui-migration.md) records the new entrances and acceptance
evidence. The supplied HTML is a visual reference; its sample data, normalization,
prompt builder and fake AI path are not runtime dependencies.
