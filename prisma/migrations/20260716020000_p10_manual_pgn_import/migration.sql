-- Manual and OTB PGNs may not contain a played date. Keeping this nullable
-- avoids inventing an observation time that could affect review ordering or
-- time-sensitive interpretation.
ALTER TABLE "ImportedGame" ALTER COLUMN "playedAt" DROP NOT NULL;
