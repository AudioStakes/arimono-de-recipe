# Review Checklist

## Scope

- The PR matches the linked issue or plan.
- No UX redesign is hidden in readiness work.
- No plan-external refactor is included.
- No human-only decision was changed without explicit approval.

## Product Guardrails

- The copyable `レシピ依頼文` remains a first-class artifact.
- API/server/external transmission is limited to the approved `/api/recipe` Pages Function and Workers AI binding.
- No auth, storage, telemetry, analytics, provider SDK, or external LLM auto-posting was added.
- Prompt output still omits unspecified items and their rules.
- Prompt output source-of-truth remains in prompt/domain-oriented modules.

## Testability

- Behavior-critical controls have stable hooks.
- E2E behavior selectors do not depend only on styling classes.
- Structure tests remain conservative and do not replace unit/E2E checks.

## Evidence

- Commands run and exit codes are listed.
- Skipped checks have reasons.
- UI behavior changes include E2E evidence or a clear reduced-check explanation.
- Remaining risks are explicit.
- Codex did not merge.
