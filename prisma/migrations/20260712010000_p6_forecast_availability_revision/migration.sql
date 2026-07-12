CREATE TABLE "WeeklyAvailability" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'flexible',
  "preferredWeekdays" INTEGER[] NOT NULL, "defaultMinutesByDay" JSONB NOT NULL,
  "promptResolvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WeeklyAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklyAvailability_userId_key" ON "WeeklyAvailability"("userId");
ALTER TABLE "WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AvailabilityOverride" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
  "minutes" INTEGER, "unavailable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AvailabilityOverride_userId_date_key" ON "AvailabilityOverride"("userId", "date");
CREATE INDEX "AvailabilityOverride_userId_date_idx" ON "AvailabilityOverride"("userId", "date");
ALTER TABLE "AvailabilityOverride" ADD CONSTRAINT "AvailabilityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgramDayForecast" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "weeklyFocusId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'provisional',
  "plannedBlocks" JSONB NOT NULL, "expectedMinutes" INTEGER NOT NULL, "focusLinks" TEXT[] NOT NULL,
  "dueReviewPressure" JSONB NOT NULL, "rationaleSnapshots" JSONB NOT NULL,
  "methodologyVersion" TEXT NOT NULL, "inputSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramDayForecast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgramDayForecast_userId_date_status_idx" ON "ProgramDayForecast"("userId", "date", "status");
CREATE INDEX "ProgramDayForecast_weeklyFocusId_date_idx" ON "ProgramDayForecast"("weeklyFocusId", "date");
ALTER TABLE "ProgramDayForecast" ADD CONSTRAINT "ProgramDayForecast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgramRevision" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "previousFocusId" TEXT, "newFocusId" TEXT,
  "previousForecastId" TEXT, "newForecastId" TEXT, "trigger" TEXT NOT NULL,
  "changedFields" JSONB NOT NULL, "gradedDecisions" JSONB NOT NULL,
  "methodologyVersion" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgramRevision_userId_occurredAt_idx" ON "ProgramRevision"("userId", "occurredAt");
ALTER TABLE "ProgramRevision" ADD CONSTRAINT "ProgramRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
