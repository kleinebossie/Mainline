CREATE INDEX "Program_userId_createdAt_id_idx" ON "Program"("userId", "createdAt", "id");
CREATE INDEX "ActivityEvent_programItemId_occurredAt_idx" ON "ActivityEvent"("programItemId", "occurredAt");

DROP INDEX "ProgramRevision_userId_occurredAt_idx";
CREATE INDEX "ProgramRevision_userId_occurredAt_id_idx" ON "ProgramRevision"("userId", "occurredAt", "id");
