# Center Recipe Decision UX

The app UI now centers on helping the user decide what to cook today from 家にある食材・材料.

The original copy/paste prompt path remains available, but it is no longer the first visual goal of the home screen. The primary flow is:

1. Enter 家にある食材・材料.
2. Optionally mark materials as 必ず使う or 使い切る with a concrete amount.
3. View short AI料理候補.
4. Pick one candidate.
5. Use the cooking view as a compact reference.

Guardrails:

- Main user value is 今日作る料理を決める.
- No-shopping is the default policy. Candidates should use 家にある食材・材料 plus assumed pantry seasonings.
- Shopping is allowed only by explicit opt-in in a scoped future change.
- Do not show 買い足しなし as a badge. It is the baseline policy, not a special achievement.
- Prompt copy remains a secondary fallback path and must not be removed.
- Keep `AI向けレシピ依頼文をコピー` available before, during, and after the in-app AI candidate flow.
- Do not add persistence, history, favorites, family settings, login, analytics, or telemetry in the current scope.
- The cooking view is not a step-by-step player. It must not require progress tracking or saved cooking state.
- The cooking view uses tabs: `材料`, `作り方`, `味の調整`.

Why not a step-by-step cooking player:

- The approved scope is deciding what to cook, not managing an active cooking session.
- A step player implies progress state, persistence questions, and a larger accessibility surface.
- The current cooking view should stay a readable reference that works without storage.

Implementation order for the recipe-decision redesign:

1. #7 Recipe-decision architecture.
2. #8 Material usage input.
3. #9 AI request material usage.
4. #10 No-shopping policy.
5. #11 Simplified candidate cards.
6. #12 Candidate detail and cooking CTA.
7. #13 Tabbed cooking view.
8. #14 Material-first home screen.
9. #15 Empty/loading/error states.
10. #16 Testing and stable hooks.
11. #17 Documentation and ADR update.

This ADR extends ADR 0011. ADR 0011 remains the approved boundary for `/api/recipe`, Cloudflare Workers AI, and the prompt-copy fallback.
