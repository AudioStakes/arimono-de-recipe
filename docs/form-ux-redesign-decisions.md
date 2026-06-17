# Form UX redesign decisions

This document records the design decisions from the form UX grilling session before implementation starts. It complements `CONTEXT.md` and ADR 0007, and should be used as the handoff source for future refactoring, test hardening, and implementation planning.

## Current implementation understanding

- The app is a static Vite/TypeScript frontend that builds a recipe request text for users to paste into an AI chat. It must not generate recipes in-app, call APIs, require login, or send inputs externally.
- Current form configuration is centered on `src/data.ts` `combos`, while `src/ui.ts` renders the actual fields.
- `src/prompt.ts` owns prompt generation and already omits unspecified input sections.
- `src/conditions.ts` aggregates the current UI state into `PromptData`.
- `src/combo-registry.ts` contains the candidate/free-input combo behavior, chip editing, duplicate prevention, and IME handling.
- `src/output-panel.ts` and `src/sticky-footer.ts` own the prompt preview, copy flow, mobile bottom sheet, and summary chips.
- Candidate values live in `src/candidate-values/` as simple `CandidateValue[]`; keep that simplicity.
- Existing tests cover prompt output, data ordering, condition aggregation, combo behavior, servings, copy, and the sticky mobile footer.

## Existing assets to preserve

- Static frontend architecture and Cloudflare Pages-compatible `dist/` build.
- Existing combo input pattern: prepared candidates plus free input.
- Chip display, chip editing, IME-safe entry, duplicate handling, and removal.
- Real-time prompt generation and copy buttons.
- Mobile bottom panel and sticky summary chips.
- Existing candidate data, especially `pairing-targets.ts`, `recipe-directions.ts`, `cooking-methods-and-tools.ts`, and composed unavailable ingredient/seasoning candidates.
- Existing focused unit/E2E tests, updating expectations rather than throwing them away.

## Documentation already updated

- `CONTEXT.md`
  - Split old `料理区分・作りたいもの` into `料理の役割・量感` and `作りたい料理`.
  - Added `今回やりたいこと`, `材料の使い方`, `必ず使う食材・材料`, `使い切りたい食材・材料`, `使い切りたい量`, `入力済みの量を使う`, and `作りたい品数`.
  - Renamed the domain term `NG食材・調味料` to `使えない・持っていない食材・調味料`, with `NG食材・調味料` as an alias.
  - Clarified that `作り置き多め` belongs to `人数・分量`, not `料理の役割・量感`.
  - Clarified that `できるだけ使い切りたい` and `すべて使いたい` are material-use concerns, not top-level request intents.
  - Clarified that `入力済みの量を使う` is an explicit user choice, not automatic amount parsing.
- `docs/adr/0007-reorganize-form-around-recipe-request-intent.md`
  - Records the decision to reorganize the form around request intent, split overloaded recipe concepts, support flexible item count, keep material-use choices attached to the existing material list, and avoid amount parsing.

## Top-level request intent

`今回やりたいこと` is a three-choice starting point:

- `ありものでおまかせ`
- `作りたい料理がある`
- `一緒に出す料理に合わせたい`

Do not include `できるだけ使い切りたい` or `持っていない材料を除きたい` here. The former belongs to material use. The latter belongs to `使えない・持っていない食材・調味料`.

## Material input and material use

`家にある食材・材料` remains one primary list. The user may type amounts directly into material names, such as `卵2個`, `豆腐150g`, or `キャベツ1/8玉`.

`材料の使い方` is two choices:

- `おまかせ`
- `必ず使う・使い切りたい食材・材料がある`

When the second option is selected, show a material-use panel under the existing material input. The panel is based on the same `家にある食材・材料` list; do not ask users to re-enter materials.

Each material row has an exclusive three-choice use:

- `おまかせ`
- `必ず使う`
- `使い切る`

Material row behavior:

- The material name is display-only in the panel.
- Material add/edit/delete remains in the existing chip UI.
- Removing a material chip removes that material's use setting.
- Editing a material chip keeps that material's use setting.
- Re-adding a removed material starts from `おまかせ`.

When `必ず使う` or `使い切る` is selected, show amount controls:

- Default: `家にある食材・材料に書いた量を使う`
- Optional: `量を別で指定する`

Only `量を別で指定する` shows a custom amount input. Do not parse amounts automatically from material names. If the user chooses `家にある食材・材料に書いた量を使う`, pass that wording through to the prompt rather than extracting a number.

If `必ず使う・使い切りたい食材・材料がある` is selected but no material-specific choices are set, copy is still allowed and prompt sections for required/use-up materials are omitted. The UI should show a light prompt to choose at least one material. If there are no materials yet, show an empty state explaining that materials must be added first.

## Material data model

Only `家にある食材・材料` needs to become structured. Other combo values can remain `string[]`.

Suggested shape:

```ts
type MaterialUsage = "auto" | "required" | "use-up";

type UseUpAmountMode = "as-written" | "custom";

type MaterialRequest = {
  id: string;
  name: string;
  usage: MaterialUsage;
  useUpAmountMode: UseUpAmountMode;
  useUpAmount: string;
};
```

Short-term `PromptData` should carry both:

```ts
materials: string[];
materialRequests: MaterialRequest[];
```

`materialRequests` is the source of truth. `materials` is a compatibility/derived value so existing prompt, chip, mobile summary, and tests can be migrated gradually.

`MaterialRequest.id` is an in-memory client ID only. It does not need persistence. Prefer `crypto.randomUUID()` with a simple counter fallback.

## Item count and role

Add `作りたい品数`:

- `おまかせ`
- `1品だけ`
- `複数品を指定`

Default behavior:

- For `ありものでおまかせ`, top-level UI does not show `作りたい品数` or `料理の役割・量感`; users can specify them from `こだわり条件` if needed.
- For `作りたい料理がある`, do not show `作りたい品数` or `料理の役割・量感`; the concrete dish name drives the request.
- For `一緒に出す料理に合わせたい`, show `作りたい品数` with initial value `1品だけ`.

`料理の役割・量感` candidates:

- `主菜・しっかり`
- `副菜・一品`
- `小鉢・少量`
- `汁物`
- `ご飯もの`
- `麺もの`
- `お弁当おかず`

Selection behavior:

- If `作りたい品数` is `おまかせ`, hide `料理の役割・量感`.
- If `作りたい品数` is `1品だけ`, show `料理の役割・量感` as a single optional choice.
- If `作りたい品数` is `複数品を指定`, show `料理の役割・量感` as multiple optional choices. If multiple roles are selected, ask for one dish per selected role.
- For `一緒に出す料理に合わせたい`, order role choices as `副菜・一品`, `小鉢・少量`, `汁物`, `主菜・しっかり`, `ご飯もの`, `麺もの`, `お弁当おかず`.

## Servings and amount

`人数・分量` should use a lightweight preset first:

- `指定なし`
- `1人分`
- `2人分`
- `3〜4人分`
- `作り置き多め`
- `詳しく指定`

Only `詳しく指定` shows the existing `大人` / `シニア` / `子供` / `幼児` stepper UI.

## Target dish and pairing dish

`作りたい料理`:

- Used only when `今回やりたいこと` is `作りたい料理がある`.
- One value only. If the user enters another value, replace the previous one.
- Free input is primary.
- Candidate list is only a small input aid.

Initial `作りたい料理` candidates:

- `カレー`
- `オムライス`
- `ハンバーグ`
- `肉じゃが`
- `唐揚げ`
- `生姜焼き`
- `鶏の照り焼き`
- `さばの味噌煮`
- `親子丼`
- `味噌汁`

`一緒に出す料理`:

- Used especially when `今回やりたいこと` is `一緒に出す料理に合わせたい`.
- Multiple values are allowed.
- Reuse existing `src/candidate-values/pairing-targets.ts`.
- Promote this field near the top for `一緒に出す料理に合わせたい`.

When `作りたい料理がある` is selected but no target dish is entered, do not block copy. Show a light UI prompt and omit the unspecified prompt section.

When `一緒に出す料理に合わせたい` is selected but no pairing dish is entered, do not block copy. Show a stronger but still non-blocking UI prompt.

## Advanced conditions

`こだわり条件` should contain:

- `一緒に出す料理` where not already promoted by intent.
- `味付け・方向性`.
- `調理条件`.
- `使えない・持っていない食材・調味料`.
- `その他の要望`.
- For `ありものでおまかせ`, optional `作りたい品数` with `料理の役割・量感` as a dependent sub-input.

Keep the domain term `レシピの方向性`; use `味付け・方向性` as a user-facing label.

Do not keep `作りやすさ` as an independent visible field in the first implementation. Preserve `ease.ts`, but absorb common needs into `調理条件` or `その他の要望`.

## Candidate visibility

Do not delete existing candidate data. Prefer featured/priority initial candidates while search can still reach the broader lists.

Featured `レシピの方向性` candidates:

- `あっさり`
- `こってり`
- `やさしい味`
- `ご飯が進む`
- `甘辛`
- `ピリ辛`
- `味噌味`
- `ごま風味`
- `和風`
- `洋風`
- `中華風`
- `韓国風`

Featured `調理方法・調理器具` candidates:

- `電子レンジ`
- `フライパン`
- `鍋`
- `トースター`
- `ヘルシオ ホットクック`
- `炊飯器`
- `オーブン`
- `火を使わない`

`火を使わない` should move conceptually from `作りやすさ` to `調理方法・調理器具` for this UX.

`調理時間` options:

- `指定なし`
- `10分以内`
- `20分以内`
- `30分以内`
- `45分以内`
- `60分以内`

## Prompt generation rules

Universal rules:

- Do not assume buying additional ingredients.
- Do not add unavailable main ingredients.
- Natural household seasonings may be used unless they are listed in `使えない・持っていない食材・調味料`.
- Omit unspecified input sections and omit rules that only apply to unspecified sections.

Intent-specific prompt behavior:

- `ありものでおまかせ`: use compatible available ingredients; do not force all materials unless material-specific use says so. If `作りたい品数` is `おまかせ`, allow one dish or multiple dishes only when natural.
- `作りたい料理がある`: move toward the specified dish using available ingredients; do not assume shopping. If the specified dish cannot naturally work, propose a close variant and briefly explain why.
- `一緒に出す料理に合わせたい`: suggest food that works with the pairing dish(es), avoiding too much overlap in flavor, texture, oiliness, and volume. Default to adding one dish.

Material-specific prompt sections should be separate:

- `### 必ず使う食材・材料`
- `### 使い切りたい食材・材料`

For use-up materials, distinguish:

- Amount is the amount written in `家にある食材・材料`.
- Amount is separately specified in `使い切りたい量`.

For multiple-role requests, ask for one dish per selected role.

## Tests to update or add

Unit tests:

- `PromptData` / condition reader includes `materialRequests`.
- `materials` remains a derived compatibility list.
- `buildPrompt()` omits unspecified new sections.
- `buildPrompt()` emits separate required/use-up material sections.
- `buildPrompt()` handles `入力済みの量を使う` without parsing.
- `buildPrompt()` handles the three request intents.
- `buildPrompt()` handles item count: `おまかせ`, `1品だけ`, and `複数品を指定`.
- `cookTimeOptions` expected values change to `指定なし`, `10`, `20`, `30`, `45`, `60分以内`.
- Candidate data includes the agreed target dish candidates and featured candidate behavior.

E2E tests:

- Top-level intent switching changes visible fields.
- Material-use panel appears only when selected.
- Material row usage choices are exclusive.
- `使い切る` shows amount mode; custom amount input appears only for `量を別で指定する`.
- Removing a material removes its material-use row.
- Editing a material preserves its material-use setting.
- `作りたい料理` accepts only one value.
- `一緒に出す料理` accepts multiple values.
- Mobile sticky summary reflects the new high-signal fields without becoming noisy.
- Copy remains possible when prompted-but-optional fields are empty.

## Pre-implementation hardening focus

Before feature implementation, the next session should focus on existing-code hardening:

- Run a baseline check and record failures without fixing unrelated dirty worktree changes.
- Prefer targeted tests first: prompt, data, conditions, combo behavior, servings, and sticky footer.
- Add characterization tests around current prompt omissions before changing `PromptData`.
- Consider small refactors that reduce blast radius, especially around `src/conditions.ts`, `src/prompt.ts`, and `src/ui.ts`.
- Avoid large UI rewrites before the material-request state model is explicit.

## Known worktree caution

During this session, unrelated existing worktree changes were visible in files such as `AGENTS.md`, `src/combo-registry.ts`, `src/output-panel.ts`, `src/ui.ts`, and E2E tests, plus asset changes. Do not revert or overwrite those unless the user explicitly asks.

## Suggested next-session skills

- `diagnose` if baseline lint/test/build fails.
- `refactor` for preparatory code cleanup before feature implementation.
- `vitest` for focused unit test additions around prompt/data/state logic.
- `modern-web-guidance` before changing form UI controls.
- `browser:control-in-app-browser` or `playwright-interactive` after frontend UI changes.
