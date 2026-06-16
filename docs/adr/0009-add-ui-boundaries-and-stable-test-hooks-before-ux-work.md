# Add UI Boundaries And Stable Test Hooks Before UX Work

Before UX redesign work, the current UI gets stable behavior hooks and documented boundaries between rendering, event binding, data definitions, and prompt generation.

We choose stable hooks over CSS class selectors because class names should be free to change with styling. E2E tests should assert user behavior through `data-testid`, ARIA state, visible text, and prompt output, not through visual implementation details.

Guardrails:

- Keep prompt output rules out of generic visual rendering code.
- Keep recipe item definitions and candidate values data/config centered.
- Use `data-testid` and `data-state` for behavior-critical UI surfaces.
- Keep user-visible text assertions when the copy itself is behavior or accessibility.
- UX changes should preserve behavior first and styling second.
