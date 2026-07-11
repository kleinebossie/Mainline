-- Claimed invitations are one-time admission records. Delete the claimed entry
-- with its user so account erasure cannot make the invitation available again.
ALTER TABLE "AllowlistEntry"
    DROP CONSTRAINT "AllowlistEntry_usedByUserId_fkey";

ALTER TABLE "AllowlistEntry" ADD CONSTRAINT "AllowlistEntry_usedByUserId_fkey"
    FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
