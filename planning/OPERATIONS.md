# Mainline closed-beta operations

This runbook covers the P2 runtime controls. Privacy, research consent, export coverage, and hard
deletion remain P3 work.

## Deploy

1. Apply migrations with `npm run prisma:deploy`.
2. Set `BETA_OWNER_EMAILS`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
   `SENTRY_PROJECT`, and a project-scoped `SENTRY_AUTH_TOKEN` in Vercel.
3. Set `CHESS_API_USER_AGENT` to a descriptive address. Optionally tune
   `LICHESS_API_REQUESTS_PER_HOUR` and `CHESSCOM_API_REQUESTS_PER_HOUR` after reviewing expected
   beta load.
4. Deploy through the normal CI path. Confirm `/api/cron/daily` is the single 06:00 UTC Vercel
   schedule and returns HTTP 200.

The daily route fails closed when `CRON_SECRET` is absent or wrong. It returns HTTP 503 when any
user import or maintenance job fails, while each failure remains retryable in `JobRun`.
Hourly budget buckets older than seven days and successful job rows older than 30 days are removed
by the same run. Errored jobs remain available for recovery.

## Invite beta users

Create an email allowlist entry:

```bash
npm run beta:invite -- --email=person@example.com --expires-days=14
```

Create a code for an OAuth identity that does not expose email, including Lichess:

```bash
npm run beta:invite -- --expires-days=14
```

The command prints the code once. Send it through an appropriate private channel. Invite entries
expire and a code can bind to only one account. Existing pre-gate accounts, database admins, and
the narrow `BETA_OWNER_EMAILS` break-glass list keep access.

## Monitor and recover jobs

An admin sees the latest 50 job states in Settings. The panel exposes only kind, status, attempt,
timestamps, and a sanitized error code. It never shows job payloads, user data, provider responses,
or credentials.

Use Retry on an errored import, daily adaptation, or missed-day job. The runner reclaims failed and
stale leases, increments the attempt, and preserves successful keys as immutable. Imported game
rows, daily adaptation logs, and missed-day recovery events each have a second effect-level
idempotency guard so a retry cannot corrupt the core loop.

P3 may reuse the generic runner for hard deletion. P2 deliberately does not implement or dispatch
the purge itself.

## Error monitoring and operational analytics

Use a dedicated Sentry project. Keep provider-side request-body capture and default PII disabled.
The application also applies a fail-closed filter that removes:

- OAuth tokens, Authorization and cookie headers;
- request and response bodies, query strings, route identifiers, PGNs, and form text;
- user identity, email, IP address, arbitrary breadcrumbs, and raw exception messages;
- arbitrary tags and extras.

Only stack frames, error class, request method, and an allowlisted operational event shape leave the
process. Core-loop events contain operation, status, optional platform/job kind, duration, and count.
They contain no user id or content payload. Session replay and performance tracing are disabled.

After deployment, trigger one safe test error in a non-production environment and confirm that the
received event contains no headers, cookies, query string, user identity, game data, or free text.

## PWA check

On the deployed HTTPS origin:

1. Confirm `/manifest.webmanifest` names the 192px, 512px, and maskable icons.
2. Confirm `/sw.js` returns `Cache-Control: no-cache, no-store, must-revalidate` and scope `/`.
3. Install Mainline from a Chromium browser and launch it in standalone mode.
4. Confirm training still reports cross-origin isolation and multi-thread Stockfish can initialize.
5. In browser storage tools, confirm only `/_next/static/`, `/icons/`, and `/stockfish/` responses are
   service-worker cached. Authenticated HTML, `/api/`, tRPC, OAuth, PGNs, and user data must not be
   present.
