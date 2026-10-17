# ありもの de レシピ — UI design

## Direction

Use the supplied production HTML as the visual reference: a quiet cream kitchen
workspace, the approved refrigerator title logo, yellow primary actions and sage
selected values. Center the logo and subtitle; left-align form content. Use local
system sans-serif fonts without external font requests. The logo asset is
`public/brand/arimono-title-logo.png`; its wordmark already colors `de` in sage.

## Tokens

`src/styles.css` implements these tokens. Keep changes here and in the stylesheet
consistent. The source of truth for input and recipe semantics remains the
application and domain modules, not this visual specification.

```css
:root {
  color-scheme: light;
  --canvas: #fffbed;
  --surface-solid: #fffef9;
  --surface-soft: #fcf8e7;
  --surface-field: #fffefb;
  --ink: #373b2f;
  --ink-strong: #303b29;
  --muted: #515645;
  --line: #e3e0cc;
  --line-strong: #8f947e;
  --primary: #f6e5a6;
  --primary-hover: #efdb8e;
  --primary-deep: #414f35;
  --ingredient: #62734f;
  --ingredient-soft: #eef3e6;
  --ingredient-line: #afbc9f;
  --error: #a3312a;
  --error-soft: #fff6f2;
  --overlay: #56513f5c;
  --shadow-floating: 0 10px 24px #373b2f1a;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --page-gutter: clamp(16px, 3vw, 32px);
  --brand-logo-horizontal-width: 400px;
  --sticky-footer-space: 160px;
  --viewport-block: 100dvh;
  --material-amount-width: 110px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
}
```

## Layout and controls

- Maximum content width: 1160px. Mobile title: 330px; desktop title: 400px.
  Crop the supplied 3:1 transparent asset to the reference 4:1 title frame.
- Use one page scrollbar. At 1024px, place materials and request options in
  1.16fr / 1fr columns with a 36px gap. Place the shared answer below them.
- Keep material input and candidate button before specified values. Material
  cards display latest first; the domain order and prompt order remain unchanged.
- Each material has a name editor, amount and a 44px delete control, followed by
  three native radio choices. Preserve native checked indicators as well as sage.
- Use 110px for the amount column, 152px on desktop and 96px below 360px. Name
  editors wrap and may not widen the page. All text inputs are at least 1rem.
- Request options are grouped in this order: servings; methods/tools; intent,
  time and preferences. Closed sections show their current specified values.
- Use 44px minimum interactive targets, 46px ordinary controls, 52px primary
  and copy actions, 56px nested toggle rows and 80px top-level toggle rows.
- The bottom action bar stays available at all widths. Reserve 160px and the
  safe-area inset below normal-flow content. Its content is at most 860px wide.
- Keep the bottom copy label on one line. Give its column enough intrinsic width
  for system-font differences and larger default text, sharing remaining space
  with the primary action.
- Only opened preview sheets/dialogs scroll internally. Preview text is between
  160px and 48dvh. Read-only full request text uses the same sans-serif font.
- Candidate lists scroll above content, at most 320px tall. They remain ordinary
  combobox lists. Modal preview and privacy retain background inertness, focus
  loops, Escape and opener restoration.
- Privacy is at most 680px wide and fits within 100dvh minus outer spacing.
- A long answer table scrolls within its own container. Table cells have a 96px
  reading width. Generated Markdown uses existing safe rendering.

## Type, spacing and accessibility

The text scale is 0.7rem for compact amount labels at narrow widths, 0.75rem for
metadata, 0.8rem for hints, 0.85rem for supporting controls, 0.95rem for answers,
1rem for editable text, 1.125rem for section headings and 1.25rem for symbols.
Use 1.5, 1.6, 1.65 or 1.75 line height according to density. Paragraphs and
controls use the spacing tokens above. Borders are 1px; focus outlines are 3px
with a 3px offset. Screen-reader-only content occupies 1px and uses a 50% clip.
Avoid motion beyond native scrolling; reduced motion removes animation and
transition. Empty control surfaces use:

```css
.plain-control { background: transparent; }
```

## Responsive token variants

```css
@media (min-width: 1024px) {
  :root { --material-amount-width: 152px; }
}
@media (max-width: 359px) {
  :root { --material-amount-width: 96px; }
}
```
