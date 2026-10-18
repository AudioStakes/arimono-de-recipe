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
  --sticky-footer-space: max(160px, calc(8rem + 32px));
  --viewport-block: 100dvh;
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
- Each material has two visibly labelled editing fields, the amount example
  `150g、1/2個` as a placeholder, three native usage choices and a top-right ×.
  Name and amount controls share a 46px minimum height and aligned top edges.
  Give name and amount a 7rem and 8rem minimum basis with 3:2 flexible growth, and let them
  stack when text size or available width requires it. Never shrink their text.
- Keep cards compact with 8px padding and a 4px label-to-input gap. Reserve a
  46px label band and 46px end padding for the × target so it cannot overlap
  labels or inputs, including when fields stack. The × glyph is 1.25rem; its
  button retains a 46px touch target without a separate action row. Keep the
  usage fieldset legend visually hidden while preserving its accessible name.
- Name buttons keep a single line with ellipsis and the full accessible name and
  title; activating them opens the existing native text editor. All text inputs
  remain at least 1rem. The short amount placeholder must fit in full at 320px.
  Long examples in other combo fields and supplemental notes use wrapping,
  described help text.
- Usage radios wrap by their content width. Preserve native checked indicators
  as well as sage. Preserve the amount error's described relationship when invalid.
- Request options are grouped in this order: servings; methods/tools; intent,
  time and preferences. Closed sections show their current specified values.
- Use 44px minimum interactive targets, 46px ordinary controls, 52px primary
  and copy actions, 56px nested toggle rows and 80px top-level toggle rows.
- AI model choice uses a labelled native select with a 46px minimum target and
  a font-relative explicit height, retaining Safari's native-control sizing. Keep
  the current recipient described beside it. Keep model metadata separate from
  recipe request output.
  Use `block-size: max(46px, calc(1.5em + 18px))`: the line box plus 16px vertical
  padding and 2px of border, with the ordinary minimum target retained.
- The bottom action bar stays available at all widths. Reserve at least 160px,
  increasing with text size, and the safe-area inset below normal-flow content.
  Its content is at most 860px wide. Main and fixed action rows use the same
  intrinsic-width wrapping: keep ordinary labels on one line, and stack actions
  when both do not fit. Long copy-error feedback can wrap. Recipient and preview
  controls also wrap instead of compressing the send button.
- Serving steppers use a 9.5rem minimum card basis and adapt their column count.
  Keep the count on one line, including 10 people and enlarged text.
- Only opened preview sheets/dialogs scroll internally. Preview text is between
  160px and 48dvh. Read-only full request text uses the same sans-serif font.
- Candidate lists scroll above content, at most 320px tall. They remain ordinary
  combobox lists. Modal preview and privacy retain background inertness, focus
  loops, Escape and opener restoration.
- Privacy is at most 680px wide and fits within 100dvh minus outer spacing.
- A long answer table scrolls within its own container. Table cells have a 96px
  reading width. Generated Markdown uses existing safe rendering.

## Type, spacing and accessibility

The text scale is 0.8rem for material field labels and help, 0.75rem for
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

## Responsive fields

Field and action wrapping follows available space and text size. The 1024px
workspace breakpoint changes the overall column layout; it does not prescribe
a narrow fixed width for the amount field.
