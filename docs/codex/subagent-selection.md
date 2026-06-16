# Subagent Selection

Use at most one primary implementation agent. Do not recursively spawn agents. Reviewer agents must not edit files.

| Work | Primary Agent | Reviewer |
|---|---|---|
| UX / frontend behavior | `frontend-developer` | `architect-reviewer` |
| Stable hooks / Playwright / test coverage | `test-automator` | `reviewer` |
| Static-only / privacy / no external transmission risks | `security-auditor` | `reviewer` |
| Tooling / scripts / structure tests | `tooling-engineer` | `reviewer` |
| Docs / ADR / PRD consistency | `documentation-engineer` | `reviewer` |
| Final PR review | `reviewer` | `security-auditor` if privacy or transmission is touched |

Read-only agents:

- `architect-reviewer`
- `security-auditor`
- `reviewer`

Workspace-write agents:

- `frontend-developer`
- `test-automator`
- `tooling-engineer`
- `documentation-engineer`
