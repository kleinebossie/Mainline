CREATE TABLE "RecommendationExposure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programItemId" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "servedRecommendation" JSONB NOT NULL,
    "eligibleAlternatives" JSONB NOT NULL,
    "exposedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationExposure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationExposure_programItemId_key"
ON "RecommendationExposure"("programItemId");

CREATE INDEX "RecommendationExposure_userId_exposedAt_idx"
ON "RecommendationExposure"("userId", "exposedAt");

CREATE INDEX "RecommendationExposure_methodologyVersion_exposedAt_idx"
ON "RecommendationExposure"("methodologyVersion", "exposedAt");

ALTER TABLE "RecommendationExposure"
ADD CONSTRAINT "RecommendationExposure_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecommendationExposure"
ADD CONSTRAINT "RecommendationExposure_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecommendationExposure"
ADD CONSTRAINT "RecommendationExposure_programItemId_fkey"
FOREIGN KEY ("programItemId") REFERENCES "ProgramItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
