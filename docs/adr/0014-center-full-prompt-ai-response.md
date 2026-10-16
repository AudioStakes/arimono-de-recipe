# Center Full-Prompt AI Response

## Status

Accepted by the owner on 2026-10-16. This supersedes ADR 0012's candidate generation, selection and cooking-view flow. ADR 0011's same-origin API and explicit-transmission boundary remain in force.

## Decision

Use `buildPrompt(data)` as the single request text for both in-app AI submission and prompt copy. The primary action sends the complete `{prompt}` payload to the existing `/api/recipe` endpoint. The secondary copy action remains directly available before, during and after submission.

Remove the structured three-candidate contract, candidate model, schema, list/detail views and cooking tabs. Keep material input and amount validation. Do not change recipe request output rules as part of this flow change.

Render the free-text AI answer as styled Markdown outside the request preview. Use a maintained Markdown parser, escape raw HTML, block dangerous protocols, and disable image output so an answer cannot initiate third-party image requests. Keep only safe, explicit link navigation. Markdown is presentation, not validation of ingredients, allergy constraints or cooking safety.

Declare [micromark 4.0.3](https://github.com/micromark/micromark/releases/tag/4.0.3) and [micromark-extension-gfm-table 2.1.2](https://github.com/micromark/micromark-extension-gfm-table/releases/tag/2.1.2) as direct runtime dependencies. Both are maintained MIT packages from the parser family already used by the repository's document tooling. Use the parser's public construct-disable and table APIs rather than a custom Markdown parser or a second HTML sanitization library. Normalize links in the detached result before inserting it into the page; permit only absolute HTTP(S) URLs.

Bound untrusted answer parsing to 20,000 input characters, 64 table columns, 1,000 total cells across tables and 200,000 generated HTML characters. Count table cells through public extension events before missing-cell padding can amplify the output. Parser failures and budget overruns become a recoverable display error, without truncating the request or disabling copy.

Use one answer surface shared by desktop and mobile. Preserve pending-input confirmation, request size limits, abort/stale-response handling, timeout cleanup and local copy recovery. Announce loading and completion without moving focus on asynchronous completion. Keep the mobile request-preview sheet's focus and background-scroll controls.

## Consequences

The application has one AI request contract and one answer flow. Users can read headings, lists, emphasis and tables directly, or copy the unchanged request to another AI. Candidate-specific condition matching is removed with the candidate feature; the remaining free-text answer was never automatically checked against material or NG conditions.

No new endpoint, model, persistence, authentication, telemetry or deployment model is introduced. The existing free-tier and output-token limits still apply; answers may be incomplete or incorrect. See the [implementation scope and acceptance criteria](../prd/direct-ai-recipe-flow.md).
