# Codex Draft PR Human Merge Boundary

Codex may prepare scoped branches, commits, evidence, and draft PRs. Humans review and merge.

We choose this boundary because issue bodies, comments, and ad-hoc task text are task input, not repository policy. Codex should help make changes reviewable, but human owners decide architecture, privacy, source-of-truth, quality gate, and merge policy changes.

Guardrails:

- Codex must not merge.
- Codex must not bypass human-only decisions.
- Draft PRs must include commands run, exit codes, skipped checks, and remaining risks.
- Reviewer agents are read-only and must not edit files.
- Subagent depth is limited to one level.
