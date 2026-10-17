# UI migration

## Plan and test boundary

Keep the existing UI during stage 1. Introduce a small typed application API whose
committed recipe requests and AI lifecycle are independent of DOM, CSS and
Clipboard. Test public operations, detached snapshots, prompt output and injected
AI requests in Node. Reuse the existing candidate data, normalization, servings,
material validation, prompt builder and AI client. After stage 1 checks pass,
connect the supplied cream/yellow/sage design to that same API.

Package delivery as three commits: the application API and Node tests; the new
UI and browser regressions; documentation and screenshots. Open a draft PR for
human review. Merge and deployment remain outside this task. Browser presentation
state (IME, drafts, focus, suggestion panels and dialogs) belongs to adapters.

## Feature map

| Feature | Current implementation / tests | Application operation | New UI entrance | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| Materials and IDs | combo-registry, ui / input, browser-interaction-regressions | commitInput, editValue, removeValue | Material input and cards | Exact duplicates, rename preserves ID/amount/usage; merge preserves destination | Verified: Node/E2E |
| Full candidates | data, suggestions / data, suggestions, app | getSuggestions | Candidate button after input | Initial 20, featured-first search, selected exclusion, no mutation | Verified: Node/E2E |
| Usage and amount | recipe-decision/materials, prompt / recipe-decision, direct-ai-flow | updateMaterial | Card amount and three usage choices | Optional all modes; use-up requires explicit nonblank amount | Verified: Node/E2E |
| Amount meaning | types, prompt / prompt | updateMaterial | Card amount | Preserve as-written/custom; no name parsing or conversion | Verified: Node/E2E |
| Intent | conditions, ui / conditions, input | setRequestIntent | Request options | Hidden values retained, inactive values omitted | Verified: Node/E2E |
| Servings | servings, serving-controls / servings | setServingsMode, adjustServings | First request option | Presets, custom groups 0..10; no new rounding | Verified: Node/E2E |
| Recipe count and roles | conditions, combo-registry / prompt, input | setRecipeCount, commitInput | Intent and count options | Pairing auto becomes one; target excludes roles; single keeps first | Verified: Node/E2E |
| Tools | data, combo-registry / input | commitInput, editValue, removeValue | Second request option | Full candidates and free values, Hot Cook accessible | Verified: Node/E2E |
| Time | combo-field, data / prompt | setCookTime | Time option | Unspecified/10/20/30/45/60, omission | Verified: Node/E2E |
| Directions | data, combo-registry / input, prompt | commitInput, editValue, removeValue | Preferences | Full catalog and free values | Verified: Node/E2E |
| NG materials and seasonings | candidate-values / data, input | commitInput, editValue, removeValue | Preferences | Composed catalog, edits/deletes, prompt | Verified: Node/E2E |
| Other requests | conditions, prompt / prompt | setSupplementalNotes | Preferences | Free text and omission | Verified: Node/E2E |
| Full request text | prompt, conditions / prompt | getSnapshot | Preview, copy, send | Stable section/material order and same body | Verified: Node/E2E |
| Copy | output-panel / copy, direct-ai-flow | getSnapshot after draft commit | Fixed secondary action with icon | Input/request errors and loading preserve copy; fallback focus | Verified: Node/E2E |
| AI lifecycle | ai-recipe-client, ai-prompt-panel / ai-prompt-client, direct-ai-flow | send, cancel, reportRenderFailure | Fixed primary action, answer area | Explicit send only; injected client; abort plus generation guards | Verified: Node/E2E |
| Safe Markdown | recipe-markdown / recipe-markdown, direct-ai-flow | reportRenderFailure | Separate answer area | Existing parser budgets, raw HTML/URLs/images blocked | Verified: Node/E2E |
| Browser interaction | combo-registry, app-events / browser-interaction-regressions | commitInput plus adapter events | Inputs, candidates, preview | IME, Enter/blur, focus, modal trap/return/resize, reduced motion | Verified: Node/E2E |
| Public surroundings | web-analytics, ui / assets, browser-interaction-regressions | None | Footer and privacy dialog | CSP, exact production origin, no form analytics, narrow access | Verified: Node/E2E |

Stored strings trim outside whitespace only. Search normalization is separate.
Comma punctuation and internal spaces are retained. Duplicate matching is exact
and case-sensitive. Canonical material order is insertion order; latest-first is
only a view. Target dish is single; pairing dishes are multiple. Switching roles
to one discards all but the first as before. Hidden inputs otherwise remain stored.

## Evidence

- Baseline `npm run check`: format, lint, typecheck, build, unit and structure
  passed; E2E server startup failed in the restricted environment (exit 1).
- Node commands use `ASDF_NODEJS_VERSION=26.4.0` because no repository-local asdf
  version is selected. No dependency or package-manager change is required.
- Modern Web Guidance CLI could not reach npm (ENOTFOUND). Native dialog and
  inert behavior checked against [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal).

### Stage 1 acceptance

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run test:unit`, `npm run test:structure`: exit 0 after the final API changes.
- Full old-UI E2E run: 490 passed, 10 WebKit failures. Trace/event inspection
  identified unchanged send-label replacement during blur swallowing clicks.
  Avoiding unchanged AI presentation updates fixed it.
- `npm run test:e2e -- --project=webkit --project=mobile-safari
  --project=tablet-safari tests/e2e/direct-ai-flow.spec.ts
  tests/e2e/browser-interaction-regressions.spec.ts`: exit 0, 132 passed,
  0 skipped/flaky. The other 490 old-UI cases passed in the full run.
- One structure-test rerun during concurrent browser load timed out; the serial
  rerun passed without changing its assertions or timeout.
- Read-only architecture review: added ID-based material operations, semantic
  amount updates and input/error/retry coverage. No unresolved important finding.
- Application imports no DOM modules at runtime. Snapshots detach all arrays and
  objects; controllers and executable dependencies remain private. The old UI
  now projects this state; IME, drafts, focus, Clipboard and dialogs stay in adapters.
- TDD red/green slices: materials, effective requests, generations, candidates,
  stable-ID operations (`/tmp/arimono-red-1.log` through `red-5.log` and matching
  green logs). Tests run in Vitest's Node environment without DOM or jsdom.

Stage 1 accepted; proceed directly to the supplied UI design.

### Stage 2 acceptance — 2026-10-17

`CI=1 ASDF_NODEJS_VERSION=26.4.0 npm run check` completed with **exit 0**.
The command ran format, design/code/HTML/Markdown/YAML lint, both TypeScript
checks, the Vite build, unit tests, structure tests and the full E2E matrix.
Error-only reporters emitted no failures. Playwright reported **560 passed,
0 failed, 0 skipped, 0 flaky** (163 seconds for E2E).

| Playwright profile | Passed |
| --- | ---: |
| chromium | 110 |
| mobile-chrome | 110 |
| firefox | 85 |
| webkit | 85 |
| mobile-safari | 85 |
| tablet-safari | 85 |

Before PR delivery, reran `CI=1 ASDF_NODEJS_VERSION=26.4.0 npm run check`:
exit 0, the same 560 passed and no failures, skips or flaky results (166 seconds
for E2E). The delivery log is `/tmp/arimono-pr-check.log`. Also exported the
application-API commit alone into an isolated tree with the existing dependency
installation and ran `npm run typecheck`, `npm run build` and
`npm run test:unit`: all exit 0 with the old UI retained.

The 8 new Node application tests cover materials/IDs/amount modes, effective
requests and hidden values, candidate access, snapshot isolation, notifications,
input and transport failures, retry, cancellation and delayed-response generations.
Existing prompt, client, function and safe-Markdown tests remain in place.

Browser regressions also cover newest-first cards with insertion-order prompts,
44px card controls, native amount/usage keyboard events, pending edits before
copy/send, delayed blur while typing in another card, candidate Tab exit,
collapsed count/role summaries and 1280x390 fixed-bar error clearance. A wide
Markdown-table fixture now has 16 columns so it exceeds the new full-width
answer surface as well as the mobile surface; scrolling and quantity assertions
are retained.

#### Review findings and resolutions

- Restrict combo event delegation to its actual inputs/options/pills; card amount
  and usage events keep native focus and keyboard behavior.
- Preserve active amount selection/focus across a material insertion. Commit a
  pending addition before creating a name editor so a delayed blur cannot save
  partial typing or remove the editor.
- Explicit copy/send commits completed IME text immediately; composing text is
  left pending and the separate confirmation-Enter guard remains intact.
- Use actual fixed-footer bounds for input/error clearance at all widths.
- Announce AI status in one region, avoid unchanged answer/count rewrites, and
  show active count/role/preferences in collapsed request summaries.
- Remove the indirect DOM-controller type dependency from `conditions.ts`.
- Read-only architecture and interaction/privacy reviews have no unresolved
  important findings. A reviewer reproduced and rechecked the two blur races in
  Chromium at 390x844.

Safari's native keyboard setting can skip radio groups during Tab navigation.
The updated navigation regression accepts that native step while still requiring
focus to reach the next material and preserve subsequent typing. No test was
skipped or timeout increased. Diagnostic logs remain at
`/tmp/arimono-final-check.log`; prior failing traces are under
`/tmp/arimono-ui-evidence/diagnostics/` and their prior result summary is
`/tmp/arimono-stage2-prior-results.json`.

#### Visual evidence and limits

- Visually inspected Chromium screenshots at 320x700, 390x844 and 1280x900.
  Updated [desktop screenshot](../media/desktop.png) and
  [mobile screenshot](../media/mobile.png); the 320px capture is
  `/tmp/arimono-ui-evidence/320.png`.
- Browser tests include long names, multiple materials, empty/error states,
  tables, privacy, preview traps/restoration, resize and reduced motion across
  the configured profiles. These are Playwright/browser emulation results.
- Physical iOS devices and software keyboards were not tested. Live Workers AI
  generation was not exercised; controlled responses and injected transports
  verify the existing client and application paths without live AI requests.
- No selected formal check was skipped. `npm ci` was unnecessary because the
  existing installed dependencies were usable and manifests/lockfile did not
  change. Dependency audit was outside this migration's unchanged dependencies.

#### Intentional UI changes and retained behavior

The supplied local logo, cream/yellow/sage palette, centered subtitle, compact
material cards and three request entrances replace the previous layout. Inputs
precede specified values; material cards are latest first. Servings and tools
precede purpose/time/preferences; fixed send/copy actions are available at every
width. Tab follows the new card order (name/delete, amount, usage, next card).
The answer remains a separate normal-flow surface below inputs.

Prompt section/material order, exact-string storage and duplicate rules,
as-written/custom semantics, inactive-value retention, count/role dependencies,
candidate catalogs, local copy recovery and explicit same-origin full-prompt AI
submission remain unchanged. No auth, persistence, new endpoint, provider,
analytics expansion, external font/image request or dependency was added.

Main ownership: `src/recipe-application.ts` (canonical requests and lifecycle),
`src/combo-options.ts` (existing catalog ordering), `src/ui.ts` and browser adapters
(projection/events), `src/styles.css` / `DESIGN.md` / local logo (visual design),
plus Node/E2E coverage and the architecture/testing documents. Existing prompt,
AI client, safe Markdown, Workers Function, analytics and CSP implementations
remain the sources of truth. The starting HEAD is
`e4effb77dff608fd6118cddc998a3bf0568fba89`. Delivery separates the application
boundary, UI migration and review evidence into commits on a feature branch.
The draft PR leaves approval and merge to a human; no deployment is performed.

### CI follow-up — 2026-10-17

PR #53's [initial CI run](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/39000856532)
failed only the 320px Chromium action-choice test: the copy label wrapped onto
two lines on Linux. The equal-width columns left too little room for the icon,
gap and platform font. The supplied HTML and old UI both kept that label on one
line; the migration had omitted this constraint.

Restore nonwrapping text and a compact icon gap, and let the copy column reserve
its intrinsic width while otherwise retaining equal columns. Add a 320px test
with an 18px root font so wider text metrics reproduce on macOS too. Before the
fix it failed with two label rectangles; after the fix all 8 Chromium/mobile
action-choice cases passed. The regression also checks label containment, 44px
targets and viewport bounds. No assertion was relaxed and no test was skipped.

Visually checked 320px screenshots at 16px and 18px root sizes: the label stays
on one line, both actions remain inside the page, and the page width is 320px.
CI trace and local red-run evidence are kept under
`/tmp/arimono-ci-39000856532/` and `/tmp/arimono-copy-regression-red/`.

Final `CI=1 ASDF_NODEJS_VERSION=26.4.0 npm run check`: exit 0. All quality gates
passed, including 562 E2E cases across six profiles, with zero failures, skips
or flaky results (154 seconds for E2E). The new regression runs in both Chromium
profiles using the browser's default-font setting, without inline CSS or a gate
exception. The log is `/tmp/arimono-ci-fix-check.log`.
