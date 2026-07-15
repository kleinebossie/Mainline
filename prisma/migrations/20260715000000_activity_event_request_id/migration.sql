ALTER TABLE "ActivityEvent" ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "ActivityEvent_userId_requestId_key"
ON "ActivityEvent"("userId", "requestId");
