# Free Model Selection and Durable Usage Limits

The owner requested additional free AI choices, a model selector, protection
against excessive use, and no spending beyond a reported 62,500 credits on
2026-10-17. This decision records the narrow implementation scope of that request.
It extends ADR 0011; prompt output and the static Vite frontend remain unchanged.

## Decision

- The browser still uses only `/api/recipe`. GET with `?models` reads public
  configuration metadata without recipe input or inference. Explicit POST sends
  the complete current request and an optional allowlisted model ID.
- Cloudflare Workers AI remains the primary provider. Use the three currently
  verified models in `src/ai-models.ts`; legacy fast Llama is replaced with the
  verified FP8 model. Groq's production GPT OSS 20B is an optional Free-only path.
- Keys stay in Pages Function secrets. `server/ai-provider.ts` is the only
  outbound provider adapter, with one fixed Groq HTTPS endpoint. No arbitrary
  endpoint, client key, auto retry, routing to a paid model, or SDK is introduced.
- Require durable usage storage, an HMAC secret, and explicit Free-account
  configuration before any inference. Missing configuration, missing trusted
  edge identity, storage error or exhausted limits stops dispatch.
- Reserve short-term, daily, global and provider budgets in one D1 batch.
  CHECK constraints turn exhausted counters into transaction rollback. Treat
  failed or timed-out requests as spent; do not refund uncertain inference.
- No login or recipe persistence is added. Store only bucket keys, reserved
  units, limits and expiry. Network keys are daily HMACs of the trusted edge IP;
  IPv6 uses /64. Delete expired counters on the next inference attempt. IP limits
  are shared by networks and are not a guarantee of identifying a unique person.
- Show the selected provider before sending and update the privacy dialog with
  Groq's data treatment and D1's aggregate storage. Keep copy usable on every
  limit and failure. Do not switch providers automatically when one is disabled.

## Billing boundary

Free account enforcement is the actual billing backstop. Application neuron and
token reservations are conservative estimates and additional abuse controls;
they cannot control another app sharing the provider account or a future price
change. A Free-only flag is operator attestation, not an API check of billing.
Operators must retain the provider Free plan and avoid auto top-up or paid
upgrades. Do not claim the estimator alone guarantees a zero provider bill.

The reported 62,500 credit balance has no confirmed service or unit yet. No
OpenAI API adapter or pooled Pro credential is activated. ChatGPT/Codex credits,
API money and model tokens are distinct. OpenAI's native spend limits can lag.
An actual prepaid API integration needs a separately confirmed funding unit,
conversion and worst-case prices before its lifetime reservation can be enabled.
This is an unresolved part of the owner's requested goal, not completed support.

## Alternatives and consequences

In-memory counters reset across isolates and deploys; browser-only counters can
be bypassed. KV counters do not provide the required atomic multi-limit update.
An external auth service or a new Worker would expand the architecture. D1 binds
directly to the existing Pages Function and provides transactional reservation,
at the cost of a small amount of pseudonymous usage persistence.

Deploying this change without D1 and its secrets disables in-app AI safely.
Provisioning and enabling production providers remain explicit operator steps;
this coding task does not modify cloud resources, credentials or billing plans.
See [research and primary sources](../research/free-ai-api-options.md) and
[operator setup](../architecture/ai-provider-setup.md).
