# OPERATIONS.md: Open Beta Operations and Runbooks

This runbook defines deployment procedures, runtime monitoring, account privacy operations, and research export controls.

## Context Pointers

- **Orientation**: See [AGENTS.md](file:///home/joebos/programming/Mainline/AGENTS.md) for database isolation rules and local test commands.
- **Readiness Gates**: See [SHIPPING.md](file:///home/joebos/programming/Mainline/planning/SHIPPING.md) for rollout stage criteria and rollback rules.
- **Data Privacy**: See [VISION.md](file:///home/joebos/programming/Mainline/planning/VISION.md#data-privacy-and-the-built-in-study) for privacy principles and consent policies.

---

## 1. Deployment Runbook

Follow these steps to deploy Mainline to production:

1. **Apply Database Migrations**:
   Run `npm run prisma:deploy` to apply pending migrations.
2. **Configure Required Environment Variables**:
   Ensure the following environment variables are set in the hosting provider:
   - `AUTH_SECRET`: Random secret for session authentication.
   - `CRON_SECRET`: Random secret for daily cron authorization.
   - `BETA_OWNER_EMAILS`: Comma-separated list of owner emails for break-glass access.
   - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`: Error tracking configuration.
   - `CHESS_API_USER_AGENT`: Descriptive contact email or URL for external APIs.
   - Optional rate limits: `LICHESS_API_REQUESTS_PER_HOUR`, `CHESSCOM_API_REQUESTS_PER_HOUR`, and `MANUAL_IMPORT_REQUESTS_PER_HOUR`.
3. **Verify Cron Schedule**:
   Confirm that `/api/cron/daily` is scheduled at 06:00 UTC and returns HTTP 200.
4. **Verify Migration Status**:
   Execute `npx prisma migrate status` to confirm all migrations are applied cleanly.
5. **Configure Research Export Secret (Optional)**:
   When enabling research exports, configure `RESEARCH_EXPORT_SECRET` with a unique random string of at least 32 characters. Do not reuse `AUTH_SECRET` or `CRON_SECRET`.

### Daily Cron Execution Mechanics

The daily cron endpoint (`/api/cron/daily`) fails closed if `CRON_SECRET` is missing or incorrect. The cron executes the following actions:

- Prunes expired operational records.
- Enqueues daily adaptation workloads into `JobRun`.
- Drains queued jobs within the serverless function deadline.
- Removes hourly rate-limiting buckets older than 7 days.
- Removes finished job rows older than 30 days.
- Re-enqueues incomplete account purge jobs.

If any job fails or remains queued, the endpoint returns HTTP 503 so retries continue processing the backlog safely.

---

## 2. Beta User Invitations

### Create Email Allowlist Entry

To invite a user with an email address, run:

```bash
npm run beta:invite -- --email=person@example.com --expires-days=14
```

### Create Anonymous Invite Code

To create an invite code for OAuth identities (such as Lichess) without an exposed email, run:

```bash
npm run beta:invite -- --expires-days=14
```

The command prints the invite code once. Share the code through a secure private channel. Each code binds to exactly one account.

---

## 3. Background Job Monitoring and Recovery

Administrators can inspect the latest 50 job states in the Admin Settings panel. The panel displays job kind, status, attempt count, timestamps, lease status, and sanitized error codes.

### Recovery Actions

To recover a queued, errored, or stale job:

1. Navigate to Admin Settings.
2. Click **Retry** on the target job.
3. The job runner reclaims stale leases, increments the attempt counter, and executes the job.

Imported games, daily adaptation logs, and missed-day events use idempotency guards to prevent duplicate side effects during retries.

### Account Deletion and Purge Recovery

When a user requests account deletion, the application soft-deletes the user, creates a deletion token, and enqueues an `account_purge` job.

If an account purge job fails:

1. Trigger `/api/cron/daily` or click **Retry** in the Admin Settings panel.
2. The runner reclaims the lease and executes the deletion.
3. Upon completion, the runner deletes the correlatable `JobRun` key.
4. The remaining proof is an opaque `AccountPurgeLedger` entry with no user identifier.

---

## 4. Pre-Beta Deletion Drill

Perform this verification drill before admitting beta users:

1. Create a disposable test account and populate all relations (constraints, programs, practice items, consent audit rows).
2. Export the account data and verify that no credentials or auth tokens appear in the export.
3. Request account deletion.
4. Verify that the User record and all owned relations are deleted from the database.
5. Confirm that global catalogs (Lichess puzzles, tablebase cache, curated practice items) remain unchanged.
6. Verify that the only remaining record is an opaque `AccountPurgeLedger` entry with no identifying data.

---

## 5. Controlled Observational Research Export

Administrators can generate research data exports from the Admin Settings panel.

### Export Requirements

- Every export request requires a bounded UTC date range and an explicit record limit.
- Only accounts with active consent under `research-data-use/2026-07-16` and scope `aggregate_observational_training` are included.
- Withdrawn, deleted, and non-consented accounts are excluded automatically.

### Data Pseudonymization

- Participant identifiers are pseudonymized with HMAC-SHA256 using `RESEARCH_EXPORT_SECRET`.
- The export includes recommendation ranks, scores, numeric constraints, and outcome metrics.
- The export strictly excludes raw user IDs, emails, PGN game text, free-text inputs, and external URLs.

Treat all exported datasets as confidential research data. Store files in private, access-controlled locations.

---

## 6. Manual PGN Import Limits and Boundaries

The Analysis page supports manual PGN imports subject to the following limits:

- Maximum batch size: 512 KiB.
- Maximum games per batch: 25 games.
- Maximum game size: 128 KiB.
- Maximum ply count: 600 plies per game.
- User library capacity: 500 games per account.
- Rate limit: 60 import requests per user per hour (configurable via `MANUAL_IMPORT_REQUESTS_PER_HOUR`).

Imports use SHA-256 content hashing to prevent duplicate game entries.

---

## 7. Error Monitoring and Privacy Controls

Mainline uses Sentry for exception tracking with strict data scrubbers:

- Strips `Authorization`, cookie, and session headers.
- Strips request and response bodies, query strings, and PGN texts.
- Strips user email, IP address, and personal identifiers.
- Keeps stack frames, error class names, and HTTP methods only.
- Session replay and performance profiling remain disabled.

After deployment, trigger a non-production test error to verify that no sensitive data reaches Sentry.

---

## 8. Progressive Web App (PWA) Verification

Verify PWA configuration on the deployed HTTPS domain:

1. Confirm that `/manifest.webmanifest` specifies 192px, 512px, and maskable icons.
2. Confirm that `/sw.js` returns `Cache-Control: no-cache, no-store, must-revalidate`.
3. Install the application in a Chromium browser and launch in standalone mode.
4. Verify that cross-origin isolation headers (COOP and COEP) are active and multi-threaded Stockfish initializes.
5. In browser dev tools, verify that only static assets (`/_next/static/`, `/icons/`, `/stockfish/`) are cached. API routes and user data must never be cached by the service worker.
