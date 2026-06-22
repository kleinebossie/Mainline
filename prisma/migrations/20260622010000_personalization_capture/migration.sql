-- Personalisation capture (Step 2 / Phase B): broaden what ConstraintSet stores so the
-- generator can shape the daily mix around the user's reality.
--   • ownedResources widens TEXT[] -> JSONB (structured { kind, label, externalRef? }[]).
--     The column was always empty (no feature wrote it), so the drop loses no real data.
--   • sessionStyle is a new nullable JSONB ({ depthVsBreadth, interleave }); pre-existing
--     rows read back as null and decode to the balanced default.

-- AlterTable
ALTER TABLE "ConstraintSet" DROP COLUMN "ownedResources";
ALTER TABLE "ConstraintSet" ADD COLUMN "ownedResources" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ConstraintSet" ADD COLUMN "sessionStyle" JSONB;
