## 2026-08-02 - Timing Attack Vulnerability in CRON endpoints
**Vulnerability:** String comparison (strict equality) was used to compare the `CRON_SECRET` against the incoming `Authorization` header in cron endpoints, which could allow attackers to guess the secret via timing attacks.
**Learning:** High-entropy tokens/secrets must always be compared in constant time, even in non-user-facing endpoints like background workers or cron tasks. When using `crypto.timingSafeEqual` in Node.js, ensure buffers have the same length before comparison to prevent unhandled `TypeError` exceptions.
**Prevention:** Always use `crypto.timingSafeEqual` when comparing secrets, passwords, tokens or signatures. Compare byte lengths first to prevent crashing.
