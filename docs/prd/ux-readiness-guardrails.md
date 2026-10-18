# UX Readiness Guardrails PRD

## Problem

UX work is about to begin, but selector fragility, unclear architecture boundaries, and missing Codex workflow rules can make small UX changes risky. The repo needs guardrails before UI behavior is reorganized.

## Goal

Prepare the repo so future UX changes are reviewable, testable, scoped, and reversible without changing current product behavior.

## Success Criteria

- Key behavior is mapped to unit, E2E, and structure tests.
- Stable hooks exist for behavior-critical E2E flows.
- Architecture boundaries and human-only decisions are documented.
- Mechanical structure tests catch obvious guardrail violations.
- Codex draft-PR workflow and human merge boundary are documented.

## Non-Goals

- No UX redesign.
- No runtime feature expansion.
- No backend, API, auth, storage, telemetry, or external transmission for this guardrail PRD.
- No design-system completeness.
- No monorepo conversion.
- No prompt output behavior change.

## Scope

- Documentation and policy guardrails.
- Stable test hooks in current rendered UI.
- Structure tests for static-only, selector, documentation, and package boundary checks.
- Package/public-entry boundary policy for this single Vite app.
- Codex subagent policy.
- PR and review evidence expectations.

## Superseded Scope

ADR 0011 later approved a narrow optional `/api/recipe` Cloudflare Pages Function + Workers AI path. [ADR 0016](../adr/0016-add-free-model-selection-and-durable-usage-limits.md) extends that route with fixed model/provider selection, an input-free metadata GET and D1 usage aggregates. The guardrail intent still applies outside those approved exceptions. Recipe input and answers are not persisted.

## Recipe-Decision UX Extension

The candidate-specific extension below is historical and superseded by [ADR 0014](../adr/0014-center-full-prompt-ai-response.md) and the [full-prompt AI flow](direct-ai-recipe-flow.md). Current tests cover full-request submission and Markdown answers rather than candidate cards or cooking tabs. Copy stays local; explicit POST alone sends recipe input; persistence is limited to ADR 0016's usage aggregates.

ADR 0012 centers the visible product flow on deciding 今日作る料理 from 家にある食材・材料.

The guardrail intent now includes:

- Material-first input on the home screen.
- No-shopping default unless a future explicit opt-in is approved.
- Prompt copy as a secondary fallback, not a removed legacy path.
- Candidate cards, candidate detail, and cooking tabs as behavior-critical E2E surfaces.
- Empty/loading/error/retry states for the in-app AI candidate path.

The guardrail intent still excludes login, recipe persistence, history, favorites, family settings, and broad architecture changes. D1 stores only ADR 0016's usage aggregates. Analytics and telemetry are limited to the explicitly approved Cloudflare Web Analytics exception in [ADR 0015](../adr/0015-add-cloudflare-web-analytics-and-privacy-dialog.md).
