# Test risky behavior with focused checks

Changes should protect existing behavior, but the project should favor focused checks over broad test churn. We chose this because recipe items, candidate inputs, and prompt output are tightly connected, while Playwright tests can become expensive or unstable. When behavior is complex, add or update the smallest useful automated or manual check, and temporarily skip repeatedly unstable E2E tests only with a `FIXME` that explains what to revisit.

2026-10-04: The temporary skip exception is superseded by [ADR 0013](0013-enforce-strict-nonconflicting-quality-gates.md). Record evidence and repair flaky tests; unresolved failures remain failures.
