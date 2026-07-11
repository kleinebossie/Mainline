# Mainline closed-beta operations

This runbook covers the P2 runtime controls and P3 account privacy operations. Secondary research
capture remains disabled until P9 and owner privacy-copy review.

## Deploy

1. Apply migrations with `npm run prisma:deploy`.
2. Set `BETA_OWNER_EMAILS`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
   `SENTRY_PROJECT`, and a project-scoped `SENTRY_AUTH_TOKEN` in Vercel.
3. Set `CHESS_API_USER_AGENT` to a descriptive address. Optionally tune
   `LICHESS_API_REQUESTS_PER_HOUR` and `CHESSCOM_API_REQUESTS_PER_HOUR` after reviewing expected
   beta load.
4. Deploy through the normal CI path. Confirm `/api/cron/daily` is the single 06:00 UTC Vercel
   schedule and returns HTTP 200.
5. Confirm migration `20260711030000_p3_privacy_consent_purge` is applied with
   `npx prisma migrate status`. Do not enable secondary research capture.
6. The owner must review and approve the Settings privacy and consent copy with appropriate legal
   advice. Any notice or scope copy change requires a new `CURRENT_DATA_USE_NOTICE.id`, not an edit
   under the existing id.

The daily route fails closed when `CRON_SECRET` is absent or wrong. It first records the complete
daily workload in `JobRun`, then drains within the function deadline. It returns HTTP 503 when any
job fails or remains queued, so invoking the same route again safely continues the durable backlog.
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

Use Retry on a queued or errored import, daily adaptation, or missed-day job. The runner reclaims
failed and stale leases, increments the attempt, and preserves successful keys as immutable. Imported game
rows, daily adaptation logs, and missed-day recovery events each have a second effect-level
idempotency guard so a retry cannot corrupt the core loop.

P3 reuses the generic runner for hard deletion and adds `account_purge` to daily and admin recovery.
Account purge is the privacy exception to the generic immutable-success-key rule. After a purge
completes, its correlatable JobRun key is deleted. The completed AccountPurgeLedger token is the
remaining opaque proof and contains no account identifier.

### Account-erasure recovery

An account deletion request atomically soft-deletes the account, creates a random deletion token,
and queues one `account_purge` job. The request attempts the purge immediately. Failure leaves the
job queued or errored for the daily cron and admin Retry control. Job keys contain only the random
token, never the user id. The purge deletes local credentials and account-owned rows regardless of
whether an external provider can be reached.

If a purge is interrupted, invoke the daily route or use Retry in the admin Settings panel. The job
runner reclaims stale leases. A completed or already-missing User is a successful no-op. Do not edit
the opaque purge ledger to attach an email, platform username, user id, or support note.

### Deletion drill before beta

1. Create a disposable invited account and populate every user-owned relation, including a personal
   PracticeItem and both granted and withdrawn ResearchConsent audit rows. Record counts for global
   LichessPuzzle, ResourceRef, TablebaseCache, and curated PracticeItem rows.
2. Export the account. Confirm the v2 sections are present and no OAuth token, session token,
   connection token, or invite code appears.
3. Request deletion. Simulate one failed or stale purge attempt, then retry through the admin control
   or daily cron.
4. Confirm User is absent and all directly or indirectly owned rows are gone. Search JobRun keys for
   the deleted user id and former connection ids. The result must be empty.
5. Confirm the global and curated counts from step 1 are unchanged. Confirm the only retained purge
   proof is an opaque completed AccountPurgeLedger token with no account identifier.
6. Record the date, environment, migration version, reviewer, and result in the private release log.

Mainline uses OAuth sign-in and does not create attributable VerificationToken rows. That Auth.js
table has no User foreign key. The purge therefore does not guess destructive identifier matching;
revisit this policy if an email or magic-link provider is introduced.

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
