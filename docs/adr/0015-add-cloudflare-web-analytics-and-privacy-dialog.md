# Add Cloudflare Web Analytics and a Privacy Dialog

The owner explicitly approved a small creator footer, an in-app privacy dialog, and Cloudflare Web Analytics on 2026-10-16. This is a narrow exception to the analytics restrictions in ADR 0008 and ADR 0011.

## Decision

- Keep the creator's X link and privacy button in a small, normal-flow footer. Show privacy information in a native modal dialog without leaving the app.
- Use the standard Cloudflare Web Analytics beacon for aggregate page, referrer, browser/device, and performance metrics. Add no custom events, user identifiers, or form-content payloads.
- Load the beacon after page load only on the exact production origin `https://arimono-de-recipe.pages.dev`. Local and Preview origins do not load it. Use a dedicated public site token; it is not an API credential.
- Keep Pages automatic Web Analytics injection disabled to avoid duplicate tracking. Allow only the beacon script and ingestion endpoint in CSP.
- Preserve local input/copy behavior and the explicit `/api/recipe` boundary for full-prompt AI submission. Do not add input persistence or application logging.
- Keep core input, AI submission, and copy available if analytics is blocked. Analytics is not a dependency of app initialization.

## Privacy and Verification

Cloudflare documents that usage metrics do not use cookies or localStorage and do not fingerprint people. Network communication still involves processing IP addresses. Performance metrics can include a CSS selector identifying the measured element. The app does not put recipe input in URLs or use input-derived DOM IDs, analytics events, or beacon configuration.

Verify footer visibility and modal focus/scroll behavior across the existing six browser/device profiles. Verify production CSP permits the dedicated beacon, duplicate loading is prevented, local/Preview origins are excluded, and blocked analytics does not break app controls. Automated tests stub the external beacon rather than send test traffic to live analytics.

Sources: [information collected](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/#information-collected), [analytics dimensions](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/), [FAQ and CSP](https://developers.cloudflare.com/web-analytics/faq/), [Pages automatic injection](https://developers.cloudflare.com/pages/how-to/web-analytics/).
