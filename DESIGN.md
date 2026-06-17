---
version: 1.0
name: arimono-de-recipe-design-system
description: Claude の暖かい AI プロダクト感、Starbucks の食・日常の温度感、Notion の整理されたワークスペース感を統合した「ありもの de レシピ」用 DESIGN.md。
---

# DESIGN.md — ありもの de レシピ

## 0. Design Intent

「ありもの de レシピ」は、冷蔵庫にある材料や家庭の条件を入力し、AI にそのまま渡せるレシピ依頼文を生成する静的 Web アプリである。

このデザインシステムは、以下の 3 つの参照方向を統合する。

- **Claude**: 暖かいクリームキャンバス、コーラル系 CTA、AI プロダクトらしい落ち着いた編集感。
- **Starbucks**: 食・日常・家庭を想起させるクリーム/グリーン、丸いボタン、安心感のあるカフェ的な温度。
- **Notion**: フォーム、チップ、カード、出力テキストを整理して見せるワークスペース的な明快さ。

### Source Balance

- Claude: **45%** — 全体の空気、AI プロダクト感、コーラル主色。
- Notion: **35%** — 入力欄、条件チップ、カード、出力エリアの情報設計。
- Starbucks: **20%** — 食材・家庭料理の温かさ、グリーン、ピル型 CTA、成功状態。

ブランド模倣ではなく、各デザインの構造的特徴を抽出して、このアプリ固有の「家庭料理をAIに頼みやすくする」体験へ変換すること。

---

## 1. Visual Theme & Atmosphere

### Core Mood

- **Warm AI Kitchen Workspace**: AI ツールだが冷たくしない。家庭の台所、冷蔵庫、紙のレシピカード、整理されたメモ帳の中間に置く。
- **Calm, Helpful, Non-technical**: 開発者ツールやチャット UI ではなく、家族の食事を考える人が迷わず使えるプロンプトメーカー。
- **Structured but Soft**: Notion 的な整理感は必要だが、表計算や管理画面のように硬くしない。
- **Food-adjacent, not restaurant-like**: 外食、カフェ注文、レストラン予約の文脈に寄せない。家庭料理、余りもの、冷蔵庫、今日の食卓を中心にする。

### Visual Keywords

`warm cream`, `soft coral`, `ingredient green`, `paper card`, `rounded controls`, `organized workspace`, `AI request card`, `family kitchen`, `gentle utility`

### Page Rhythm

1. **Cream hero**: アプリ名、冷蔵庫アイコン、短い説明、3ステップ導線。
2. **White/cream form surface**: 食材や条件を入力する整理された領域。
3. **AI request card**: 生成された依頼文を読みやすく表示する出力領域。
4. **Mobile bottom sheet**: スマホではコピー行動を常に近くに置く。

---

## 2. Color Palette & Roles

### CSS Token Recommendation

```css
:root {
  color-scheme: light;

  /* Canvas */
  --canvas: #fff6ec;
  --canvas-soft: #faf9f5;
  --canvas-cafe: #f2f0eb;
  --canvas-ceramic: #edebe9;
  --canvas-warm-end: #fff0e1;

  /* Surfaces */
  --surface: rgba(255, 255, 255, 0.88);
  --surface-solid: #fffdf8;
  --surface-soft: #f6f3ec;
  --surface-card: #efe9de;
  --surface-field: rgba(255, 250, 243, 0.86);

  /* Text */
  --ink: #221c18;
  --ink-strong: #141413;
  --ink-soft: #37352f;
  --muted: #74675c;
  --muted-soft: #8e8b82;

  /* Lines */
  --line: rgba(127, 67, 31, 0.16);
  --line-strong: rgba(127, 67, 31, 0.24);
  --line-soft: rgba(151, 111, 73, 0.12);

  /* Primary AI coral */
  --primary: #cc785c;
  --primary-hover: #b86449;
  --primary-active: #a9583e;
  --primary-warm: #e16833;
  --primary-deep: #7f431f;
  --on-primary: #ffffff;

  /* Food / ingredient green */
  --ingredient: #00754a;
  --ingredient-deep: #006241;
  --ingredient-house: #1e3932;
  --ingredient-soft: #d4e9e2;
  --ingredient-tint: rgba(0, 117, 74, 0.1);

  /* AI / workspace accent */
  --workspace: #5645d4;
  --workspace-active: #4534b3;
  --workspace-soft: #e6e0f5;
  --workspace-tint: rgba(86, 69, 212, 0.1);

  /* Semantic */
  --success: #00754a;
  --success-soft: #d4e9e2;
  --warning: #d4a017;
  --warning-soft: #fef7d6;
  --error: #c64545;
  --error-soft: rgba(198, 69, 69, 0.08);

  /* Elevation */
  --shadow-soft: 0 20px 48px rgba(86, 56, 28, 0.08);
  --shadow-card: 0 28px 82px rgba(68, 38, 18, 0.16);
  --shadow-floating: 0 18px 42px rgba(86, 56, 28, 0.18);
  --inner-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.78);

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-sheet: 28px;
  --radius-pill: 9999px;

  /* Layout */
  --page-gutter: clamp(16px, 3vw, 32px);
  --sticky-footer-space: 136px;
}
```

### Palette Usage

| Token | Role | Usage |
|---|---|---|
| `--canvas` | Primary app background | Page background, mobile sheet underlay |
| `--canvas-soft` | Claude-like warm cream | Header area, broad hero wash |
| `--surface` | Main card surface | Form groups, output panel, suggestion menus |
| `--surface-card` | Soft paper card | Empty states, example prompt cards |
| `--ink` | Main text | Labels, body, generated prompt |
| `--muted` | Secondary text | Lead copy, helper text, placeholders |
| `--primary` | Primary AI action | Copy button, active field highlight, main CTA |
| `--primary-deep` | Strong brand text | App title, field labels, important section titles |
| `--ingredient` | Food/ingredient signal | Food chips, success state, ingredient-specific highlights |
| `--workspace` | AI/workspace accent | Rarely: output panel badge, AI-specific chip, guide step |
| `--line` | Warm divider | Form dividers, underlined fields, card borders |

### Gradient Rules

Use only soft ambient gradients. Avoid saturated marketing gradients.

```css
background:
  radial-gradient(1200px 620px at 8% -10%, rgba(255, 255, 255, 0.86), transparent 58%),
  radial-gradient(920px 620px at 98% 0%, rgba(225, 104, 51, 0.18), transparent 50%),
  radial-gradient(700px 480px at 84% 88%, rgba(0, 117, 74, 0.08), transparent 58%),
  linear-gradient(180deg, #fffaf4 0%, var(--canvas) 42%, var(--canvas-warm-end) 100%);
```

The green radial glow should be secondary and subtle. It should suggest ingredients, freshness, and food safety, not a Starbucks clone.

---

## 3. Typography Rules

### Font Families

```css
:root {
  --font-sans: "Zen Kaku Gothic New", "Noto Sans JP", "M PLUS Rounded 1c", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: "Zen Old Mincho", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;
}
```

### Typography Philosophy

- Default UI type is **Japanese rounded/humanist sans**. This preserves approachability and mobile readability.
- Use the display serif only for optional hero accents, not for form labels or generated prompt text.
- Generated recipe request text should feel like a readable note, not code. Do **not** force monospace for Japanese prompt output.
- Use weight and spacing rather than many font sizes.
- Use slightly tight tracking on large headings, but avoid over-tightening Japanese body text.

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|---|---:|---:|---:|---|
| Display XL | `clamp(2.4rem, 5vw, 4.4rem)` | 900 | 1.0 | App title |
| Display MD | `clamp(1.9rem, 4vw, 3rem)` | 800 | 1.12 | Optional hero heading |
| Section Title | `1.35rem` | 850 | 1.3 | Form/output section headings |
| Field Label | `1rem` | 850–900 | 1.4 | Input labels, collapsible headers |
| Body | `1rem` | 400–600 | 1.6 | Explanatory text |
| Body Small | `0.9rem` | 500–700 | 1.5 | Helper text, step pills |
| Caption | `0.8rem` | 600–750 | 1.4 | Chip text, status text |
| Button | `0.95rem` | 800–900 | 1.1 | CTA labels |
| Prompt Text | `0.95rem–1rem` | 400–500 | 1.7 | Generated textarea content |

### Japanese Copy Tone

- Use clear, domestic, non-technical wording.
- Keep CTA verbs concrete: `依頼文をコピー`, `レシピ依頼文を確認する`, `条件を入力`.
- Avoid AI jargon such as `プロンプトエンジニアリング`, `LLM`, `トークン`, unless used in developer-facing docs.
- Prefer short helper sentences.

---

## 4. Component Stylings

## 4.1 App Header

### Structure

- Center-aligned on mobile and desktop.
- Contains:
  - Fridge mark / kitchen symbol.
  - App title: `ありもの de レシピ`.
  - Lead: `「ありもので何作ろう？」を、AIへそのまま渡せるレシピ依頼文に。`
  - Horizontal step pills.

### Header Style

```css
header {
  display: grid;
  justify-items: center;
  gap: 18px;
  padding-top: 8px;
  text-align: center;
}

.brand-title-text {
  color: var(--primary-deep);
  font-family: var(--font-sans);
  font-size: clamp(2.1rem, 5vw, 4.4rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 18px 26px rgba(78, 44, 22, 0.12));
}
```

### Fridge Mark

- Keep the current fridge icon concept.
- Use `--primary-deep` as the default stroke.
- Optional hover/active: small internal items can tint toward `--ingredient`.
- Do not use brand logos from Claude, Starbucks, or Notion.

---

## 4.2 Step Pills

Step pills communicate the complete flow.

```css
.flow-step {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 7px 16px;
  color: var(--primary-deep);
  font-size: 0.88rem;
  font-weight: 900;
  background: rgba(255, 249, 242, 0.88);
  border: 1px solid rgba(204, 120, 92, 0.18);
  border-radius: var(--radius-pill);
  box-shadow: var(--inner-highlight), 0 10px 24px rgba(86, 56, 28, 0.08);
}

.flow-arrow {
  color: var(--primary-active);
  font-weight: 900;
}
```

Use step pills as friendly guidance, not as navigation.

---

## 4.3 Form Fields

### Field Philosophy

Forms are the core product surface. They should look like a calm Notion-like workspace, softened by warm paper tones.

- Basic fields appear first and open.
- Advanced fields are collapsible.
- Inputs use warm underlines, not heavy boxes.
- Suggestions feel like soft paper menus.
- Food-related chips should be visually pleasant and easy to remove.

### Input Underline

```css
.underlined-field,
.textarea-field {
  border-bottom: 1px solid var(--line-strong);
}

.combo:focus-within .underlined-field,
.field-panel:focus-within .underlined-field,
.field-panel:focus-within .textarea-field {
  border-color: var(--primary);
}
```

### Field Labels

- Color: `--primary-deep`.
- Weight: 850–900.
- Icon color should match label color.
- Avoid thin labels; this app benefits from strong, reassuring labels.

### Suggestions Menu

```css
.suggestions {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 249, 242, 0.96));
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  box-shadow: 0 22px 50px rgba(86, 56, 28, 0.18);
}

.suggestion-option {
  border-radius: 12px;
  font-weight: 800;
}

.suggestion-option:hover,
.suggestion-option:focus,
.suggestion-option.is-active {
  color: var(--primary-active);
  background: rgba(204, 120, 92, 0.12);
}
```

---

## 4.4 Collapsible Advanced Fields

Advanced fields should read as organized rows in a workspace.

```css
.field-collapsible {
  border-bottom: 1px solid var(--line-soft);
}

.field-toggle {
  min-height: 56px;
  padding: 14px 0 12px;
  color: var(--primary-deep);
  background: transparent;
  border: 0;
}

.field-toggle-label {
  font-weight: 900;
}
```

### Open/Closed Behavior

- Closed state: label + icon + chevron only.
- Open state: field body slides/reveals with minimal motion.
- Chevron rotates 180 degrees or changes from `⌄` to `⌃`.
- Maintain keyboard accessibility with `aria-expanded` and `aria-controls`.

---

## 4.5 Condition Chips

Chips are important because they summarize the user's input and reduce anxiety before copying the generated prompt.

### Chip Categories

| Chip Type | Color | Role |
|---|---|---|
| Ingredient | Green | 食材, NG食材, food-related constraints |
| Cooking condition | Coral | 調理器具, 調理時間, 作りやすさ |
| Mood / flavor | Peach or lavender | 味や雰囲気 |
| AI/output state | Purple, sparingly | AIへ渡す依頼文, output status |
| Success | Green | コピー完了 |

### Chip Style

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 7px 12px;
  color: var(--primary-deep);
  font-size: 0.82rem;
  font-weight: 800;
  background: rgba(204, 120, 92, 0.10);
  border: 1px solid rgba(204, 120, 92, 0.14);
  border-radius: var(--radius-pill);
}

.chip[data-kind="ingredient"] {
  color: var(--ingredient-deep);
  background: var(--ingredient-tint);
  border-color: rgba(0, 117, 74, 0.16);
}
```

### Chip Rules

- Chips should not become visually noisy. Use light tints and strong text.
- Never use red for normal NG chips; red is reserved for actual errors.
- Keep chips horizontally scrollable in sticky mobile areas.

---

## 4.6 Serving Steppers

Serving controls need to be tactile and clear.

- Minimum hit target: 44px.
- `+` and `−` buttons use pill/circle geometry.
- Count text should be visually stable; avoid layout shift when changing `0人` to `10人`.
- Use muted separators between adult/senior/child/toddler cards.

Recommended colors:

- Label: `--primary-deep`.
- Stepper buttons: cream surface with coral border.
- Active/pressed: light coral fill.
- Child/toddler icons can use slightly warmer tints, but keep semantics clear.

---

## 4.7 Range Control — 調理時間

The cook-time slider should feel practical and low-friction.

- Track: warm cream with coral filled portion.
- Thumb: white or coral, 22–28px touch target.
- Labels: left `指定なし`, right `60分以内`, center value stronger.
- Do not over-style into a music/audio slider.

---

## 4.8 Prompt Output Section

This is the product's conversion surface. It should feel like a clean AI request card.

### Structure

- Heading: `AIへ渡すレシピ依頼文`.
- Helper text: `この文章をコピーして、ChatGPTなどのAIへ渡してください。`
- Condition chips above or near output.
- Primary copy button close to the output.
- Textarea/output area with high readability.

### Output Card Style

```css
.prompt-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 250, 243, 0.84)),
    var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft), var(--inner-highlight);
}

.output {
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  line-height: 1.7;
  background: rgba(255, 253, 248, 0.92);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
}
```

### Output Behavior

- Empty state should show a helpful placeholder or generated default, not a blank cold panel.
- The generated text should be selectable, but direct editing is not required unless product scope changes.
- The copy button should remain the strongest action on the screen.

---

## 4.9 Buttons

### Primary Copy Button

Primary CTA is Claude-coral, with a food-warm tone.

```css
.copy-button,
.copy-request-button,
.button-primary {
  color: var(--on-primary);
  background: linear-gradient(180deg, #d4896d, var(--primary));
  border: 1px solid rgba(169, 88, 62, 0.22);
  border-radius: var(--radius-pill);
  box-shadow: 0 14px 28px rgba(204, 120, 92, 0.18), var(--inner-highlight);
  font-weight: 900;
}

.copy-button:hover,
.copy-request-button:hover,
.button-primary:hover {
  background: linear-gradient(180deg, #cf7d60, var(--primary-hover));
  box-shadow: 0 18px 34px rgba(204, 120, 92, 0.22), var(--inner-highlight);
}

.copy-button:active,
.copy-request-button:active,
.button-primary:active {
  transform: scale(0.97);
}
```

### Success State

When copy succeeds, use ingredient green.

```css
.copy-button.is-success,
.copy-request-button.is-success {
  color: #ffffff;
  background: var(--ingredient);
  border-color: var(--ingredient);
}
```

### Secondary Button

```css
.button-secondary,
.sheet-toggle-button {
  color: var(--primary-deep);
  background: rgba(255, 249, 242, 0.92);
  border: 1px solid rgba(204, 120, 92, 0.18);
  border-radius: var(--radius-pill);
  box-shadow: var(--inner-highlight), 0 10px 20px rgba(86, 56, 28, 0.06);
}
```

### Button Rules

- Use full-pill buttons for major actions.
- Use rounded rectangles for cards and panels.
- Do not use square, sharp, developer-tool buttons.
- Primary CTA should not be purple; purple is a supporting workspace/AI accent only.

---

## 4.10 Mobile Bottom Sheet

The mobile bottom sheet is a critical interaction pattern.

### Visual Style

- Frosted warm surface.
- 28px top radius.
- Safe-area padding.
- Sticky chips horizontally scroll.
- Copy CTA always visible when appropriate.

```css
.bottom-actions-inner {
  background: rgba(255, 246, 236, 0.88);
  border: 1px solid rgba(204, 120, 92, 0.14);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  box-shadow: 0 -20px 52px rgba(86, 56, 28, 0.12);
  backdrop-filter: blur(24px) saturate(150%);
}
```

### Behavior

- Closed: show key chips + “レシピ依頼文を確認する” + copy button.
- Open: show full prompt output and close button.
- Background: subtle backdrop; do not make the app feel modal-heavy.
- Respect `prefers-reduced-motion`.

---

## 5. Layout Principles

### Mobile First

- Single-column layout.
- Header, form, then output preview or bottom sheet.
- Sticky bottom action area is allowed and recommended.
- Maintain enough bottom padding so content is not hidden behind sticky controls.

### Tablet

- Serving controls can become 4 columns.
- Use-flow pills remain horizontal and scrollable if needed.
- Cards remain full-width.

### Desktop

- Split layout:
  - Left: form, around 55–58% width.
  - Right: output panel, around 42–45% width.
- Use a subtle vertical warm divider between form and output.
- Output can be sticky or visually persistent if implemented carefully.

```css
@media (min-width: 1024px) {
  .app-layout {
    grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.82fr);
    align-items: start;
  }

  .form {
    padding-right: 72px;
  }

  .prompt-section {
    padding-left: 72px;
  }
}
```

### Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
--space-section: clamp(48px, 8vw, 96px);
```

Use vertical rhythm generously. This app should not feel cramped; users are making decisions about dinner, not filling out a tax form.

---

## 6. Depth & Elevation

### Elevation Philosophy

- Paper/card depth should be visible but quiet.
- Use warm brown shadows, not black/gray shadows.
- Avoid glassmorphism except on the mobile bottom sheet.
- Do not use heavy neon glows.

### Elevation Tokens

```css
--elevation-0: none;
--elevation-1: 0 10px 24px rgba(86, 56, 28, 0.08);
--elevation-2: 0 20px 48px rgba(86, 56, 28, 0.10);
--elevation-3: 0 28px 82px rgba(68, 38, 18, 0.16);
--elevation-floating: 0 18px 42px rgba(86, 56, 28, 0.18);
```

### Surface Hierarchy

1. Page background: ambient cream gradient.
2. Form body: mostly transparent / paper-like.
3. Prompt panel: strongest card surface.
4. Suggestions and bottom sheet: floating surfaces.
5. Copy button: highest action emphasis.

---

## 7. Motion & Interaction

### Motion Principles

- Motion should confirm input, not entertain.
- Micro-interactions can be tactile: buttons compress, chips appear softly, bottom sheet slides.
- Do not add bouncy or cartoonish animation.
- Respect reduced motion.

### Recommended Durations

| Interaction | Duration | Easing |
|---|---:|---|
| Button hover | 160–200ms | ease |
| Button press | immediate / 80ms | ease-out |
| Suggestions open | 120–160ms | ease-out |
| Bottom sheet open | 220–280ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| Chip add/remove | 140–180ms | ease-out |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

---

## 8. Accessibility Rules

- Maintain visible focus states on all inputs, buttons, chips, collapsible controls, and bottom-sheet controls.
- Minimum interactive target: 44px × 44px; primary mobile actions should be 48px+ high.
- Do not communicate state by color alone. Copy success should update text and `aria-live` status.
- Suggestions must work with keyboard navigation and `role="listbox"` / `role="option"` semantics where applicable.
- Collapsible panels must keep `aria-expanded`, `aria-controls`, and hidden state aligned.
- Generated output should remain readable at 320px viewport width.
- Color contrast should meet WCAG AA for all body text and controls.
- Avoid low-contrast placeholder text; placeholders are guidance, not labels.

### Focus Style

```css
:where(input, textarea, select, button):focus-visible {
  outline: 3px solid rgba(204, 120, 92, 0.28);
  outline-offset: 3px;
}
```

---

## 9. Do's and Don'ts

### Do

- Keep the app warm, domestic, and useful.
- Use coral for the primary AI action.
- Use green for food, ingredients, and success states.
- Use Notion-like cards, chips, and structured sections for clarity.
- Keep Japanese labels direct and short.
- Preserve mobile-first behavior and bottom copy action.
- Make the output area feel like a polished note that can be pasted into AI.

### Don't

- Do not copy Claude, Starbucks, or Notion logos, marks, exact brand layouts, or proprietary assets.
- Do not turn the app into a dark developer tool.
- Do not overuse purple; it should not become the primary brand color.
- Do not make the app look like a restaurant reservation, food delivery, or cafe ordering product.
- Do not rely on large food photography unless the product scope changes.
- Do not hide the copy action below the fold on mobile.
- Do not make all fields boxed and heavy; underlined fields are preferred.
- Do not make generated prompt text monospace by default.

---

## 10. Responsive Behavior

### Breakpoints

```css
--breakpoint-sm: 480px;
--breakpoint-md: 720px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

### Mobile `< 720px`

- Header centered.
- Use-flow pills horizontally scroll.
- Form and output are stacked.
- Bottom action sheet is visible.
- Sticky chips can scroll horizontally.
- Output panel in sheet maxes around 58vh.

### Tablet `720px–1023px`

- Serving grid becomes 4 columns.
- More horizontal spacing, but still one main column.
- Bottom action remains useful.

### Desktop `>= 1024px`

- Two-column layout.
- Prompt section visible beside form.
- Bottom actions hidden.
- Condition chips shown near output panel.
- Output textarea min-height can use `min(72vh, 920px)`.

---

## 11. Content & Empty States

### Empty State Tone

Use encouraging, action-oriented text.

Examples:

- `まずは家にある食材を入れてください。`
- `卵、豆腐、もやしのように、思いつく順で大丈夫です。`
- `条件を入れると、AIへ渡す依頼文がここにできます。`

### Copy Success

Use concrete next-step language.

- Default: `依頼文をコピー`
- Success: `コピーしました。AIへ渡してください`
- Sticky success: `コピーしました`

### Error / Failure

- Clipboard failure: `コピーできませんでした。文章を選択してコピーしてください。`
- Avoid blaming the user.

---

## 12. Implementation Notes for Coding Agents

When applying this DESIGN.md to the codebase:

1. Prefer updating `src/styles.css` tokens and component classes before changing DOM structure.
2. Preserve existing `data-testid` attributes. Tests may depend on them.
3. Preserve accessibility attributes already present in the UI shell.
4. Keep the app as a static Vite/TypeScript app unless explicitly asked otherwise.
5. Avoid adding large dependencies for visual changes.
6. Keep generated copy and visible labels in Japanese.
7. Do not introduce external brand assets or remote fonts unless explicitly approved.
8. If adding fonts, use system-safe fallbacks and ensure Japanese rendering remains stable.

---

## 13. Agent Prompt Guide

Use this prompt when asking an AI coding agent to redesign the app:

```text
Apply DESIGN.md to the app UI.
Keep the product identity as a warm Japanese household recipe prompt maker.
Use Claude-inspired warm AI product styling as the base, Starbucks-inspired cream/green food warmth as a secondary layer, and Notion-inspired structured cards/chips/forms for usability.
Do not copy any brand logos or exact brand layouts.
Prioritize mobile-first UX, readable Japanese text, clear condition chips, and a prominent copy action for the generated AI recipe request.
Preserve existing tests, data-testid attributes, and accessibility behavior.
```

### Quick Visual Recipe

```text
Canvas: warm cream gradient.
Primary CTA: coral full-pill.
Food/success: ingredient green.
Information architecture: Notion-like cards and chips.
Output panel: soft paper AI request card.
Mobile: bottom sheet with copy action always close.
Typography: Japanese rounded sans, strong labels, readable prompt text.
```

---

## 14. Minimal CSS Patch Direction

For a conservative first pass, make only these changes:

1. Replace current root tokens with the tokens in Section 2.
2. Keep the existing warm gradient, but add a subtle green radial accent.
3. Update copy button to coral primary with green success state.
4. Make ingredient chips green-tinted and condition chips coral-tinted.
5. Keep the current fridge icon, but allow small internal accents to use green.
6. Keep the desktop two-column layout and mobile bottom sheet behavior.

This will move the app toward the intended Claude + Starbucks + Notion blend without destabilizing the current implementation.
