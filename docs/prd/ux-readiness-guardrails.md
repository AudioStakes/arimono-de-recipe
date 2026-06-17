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

ADR 0011 later approved a narrow optional `/api/recipe` Cloudflare Pages Function + Workers AI path. The guardrail intent still applies, but the old static-only non-goal is superseded for that approved route only.

## Recipe-Decision UX Extension

ADR 0012 centers the visible product flow on deciding 今日作る料理 from 家にある食材・材料.

The guardrail intent now includes:

- Material-first input on the home screen.
- No-shopping default unless a future explicit opt-in is approved.
- Prompt copy as a secondary fallback, not a removed legacy path.
- Candidate cards, candidate detail, and cooking tabs as behavior-critical E2E surfaces.
- Empty/loading/error/retry states for the in-app AI candidate path.

The guardrail intent still excludes login, persistence, history, favorites, family settings, analytics, telemetry, and broad architecture changes.
