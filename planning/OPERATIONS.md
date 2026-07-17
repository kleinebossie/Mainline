# Mainline closed-beta operations

This runbook covers runtime controls, account privacy operations, and the P9 controlled
observational export.

## Deploy

1. Apply migrations with `npm run prisma:deploy`.
2. Set `BETA_OWNER_EMAILS`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
   `SENTRY_PROJECT`, and a project-scoped `SENTRY_AUTH_TOKEN` in Vercel.
3. Set `CHESS_API_USER_AGENT` to a descriptive address. Optionally tune
   `LICHESS_API_REQUESTS_PER_HOUR`, `CHESSCOM_API_REQUESTS_PER_HOUR`, and
   `MANUAL_IMPORT_REQUESTS_PER_HOUR` after reviewing expected beta load.
4. Deploy through the normal CI path. Confirm `/api/cron/daily` is the single 06:00 UTC Vercel
   schedule and returns HTTP 200.
5. Confirm migration `20260711030000_p3_privacy_consent_purge` is applied with
   `npx prisma migrate status`. Also confirm
   `20260716010000_p9_recommendation_exposure` is applied before generating new programs and
   `20260716020000_p10_manual_pgn_import` is applied before accepting manual games.
6. The owner must review and approve the Settings privacy and consent copy with appropriate legal
   advice. Any notice or scope copy change requires a new `CURRENT_DATA_USE_NOTICE.id`, not an edit
   under the existing id.
7. Before enabling controlled research export, the owner must review the P9 privacy boundary and
   configure a separate, randomly generated `RESEARCH_EXPORT_SECRET` of at least 32 characters.
   Never reuse `AUTH_SECRET` or `CRON_SECRET`. Leave it unset to fail closed.

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

## Controlled observational research export

Only administrators can request the export from Settings. Every request requires a bounded UTC
date window and an explicit record limit. The service checks current, unwithdrawn consent under
`research-data-use/2026-07-16` and the `aggregate_observational_training` scope. Old, withdrawn,
missing-scope, deleted, and non-consented accounts are excluded.

The export pseudonymizes participants with HMAC-SHA256 and includes safe recommendation rank and
score context, projected numeric constraints, canonical outcome measurements, and safe later
rating snapshots. It excludes identity, raw ids, PGNs, provider blobs, exact decision input,
free text, external references, and puzzle or practice identifiers. Metadata reports truncation
and missing outcomes, decision inputs, and later ratings.

Treat every result as controlled data. Store it in an owner-approved private location, do not
publish individual rows, and do not join pseudonyms to operational identifiers. Analysis supports
association language only. Findings cannot write to live methodology. Any recommendation change
still requires human review, evidence grading, a new immutable config version, golden tests,
changelog notes, and a documented rollback.

## Manual PGN and OTB import

The Analysis page accepts one pasted game, one PGN file, or a multi-game PGN file. The infrastructure
limits are 512 KiB per batch, 25 games per batch, 128 KiB per game, and 600 plies per game. These
limits protect the tRPC request and browser Stockfish queue on the deployed free tier. They are not
methodology values or training recommendations.

Manual checks and creates share a fixed-window budget that defaults to 60 requests per user per hour.
Manual libraries are capped at 500 games. The cap check and inserts run in a serializable transaction,
so concurrent batches cannot reserve the same remaining capacity. Tune the request limit with
`MANUAL_IMPORT_REQUESTS_PER_HOUR`; changing the library cap requires a reviewed code change.

Only standard chess PGN is accepted. Valid games are imported independently, so a malformed or
unsupported sibling stays out without discarding the rest. The user must identify their color for
each valid game. Date, time control, result, ratings, and event remain optional. An absent date is
stored as unknown, an absent rating creates no rating observation, and missing clock comments create
no time-use measurement. Manual import creates neither a PlatformConnection nor a
ChessProfileSnapshot.

After import, use the existing Analysis page controls to run the client-side Stockfish scan and open
structured review. Saving eligible critical moments uses the existing personal PracticeItem and FSRS
paths. Re-importing normalized equivalent content is a no-op through the manual SHA-256 dedupe key.
Chess.js preserves mainline comments such as `%clk` during canonicalization, but does not preserve
arbitrary variation and NAG structure. Keep the original source file if those annotations matter.

For the production-like smoke check, import a file containing one valid standard game, one malformed
game, and one unsupported variant. Confirm only the valid game appears under Manual PGN, a second
import reports it as already present, the browser scan saves raw features, structured review can
schedule a personal drill, account export contains the manual game and analysis, and hard deletion
removes the game and its derived rows.

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
