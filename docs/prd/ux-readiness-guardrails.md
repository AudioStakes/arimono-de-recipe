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
- No backend, API, auth, storage, telemetry, or external transmission.
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
