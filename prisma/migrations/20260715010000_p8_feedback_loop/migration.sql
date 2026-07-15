-- P8 keeps subjective training fit, operational product feedback, and prompt
-- exposure in separate user-owned records. All are erased by the User cascade.
CREATE TABLE "TrainingFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "programId" TEXT,
    "programItemId" TEXT,
    "scope" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "enjoyment" TEXT NOT NULL,
    "timeFit" TEXT NOT NULL,
    "frictionTags" TEXT[],
    "comment" TEXT,
    "methodologyVersion" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "routeContext" TEXT,
    "contactAllowed" BOOLEAN NOT NULL DEFAULT false,
    "methodologyVersion" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingFeedbackPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "programItemId" TEXT,
    "promptKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFeedbackPrompt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingFeedback_userId_occurredAt_id_idx" ON "TrainingFeedback"("userId", "occurredAt", "id");
CREATE UNIQUE INDEX "TrainingFeedback_userId_requestId_key" ON "TrainingFeedback"("userId", "requestId");
CREATE INDEX "TrainingFeedback_userId_programItemId_idx" ON "TrainingFeedback"("userId", "programItemId");
CREATE INDEX "ProductFeedback_userId_occurredAt_id_idx" ON "ProductFeedback"("userId", "occurredAt", "id");
CREATE UNIQUE INDEX "ProductFeedback_userId_requestId_key" ON "ProductFeedback"("userId", "requestId");
CREATE INDEX "ProductFeedback_category_occurredAt_idx" ON "ProductFeedback"("category", "occurredAt");
CREATE UNIQUE INDEX "TrainingFeedbackPrompt_userId_promptKey_key" ON "TrainingFeedbackPrompt"("userId", "promptKey");
CREATE INDEX "TrainingFeedbackPrompt_userId_shownAt_id_idx" ON "TrainingFeedbackPrompt"("userId", "shownAt", "id");

ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "ProgramItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingFeedbackPrompt" ADD CONSTRAINT "TrainingFeedbackPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingFeedbackPrompt" ADD CONSTRAINT "TrainingFeedbackPrompt_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingFeedbackPrompt" ADD CONSTRAINT "TrainingFeedbackPrompt_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "ProgramItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
