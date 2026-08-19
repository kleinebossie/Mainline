"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/react";
import {
  clearGuestSession,
  getGuestSession,
  hasGuestData,
} from "@/lib/guest-session";
import { trackFunnelEvent } from "@/lib/telemetry";

/**
 * Client component that detects stored guest session data upon authentication.
 * Automatically synchronizes guest history to PostgreSQL.
 */
export function GuestMigrationSync() {
  const utils = trpc.useUtils();
  const syncAttemptedRef = useRef(false);

  const migrateMutation = trpc.account.migrateGuestSession.useMutation({
    onSuccess: (data) => {
      if (!data.migrated) return;
      clearGuestSession();
      trackFunnelEvent("guest_account_migrated", {
        itemsMigrated: data.itemsMigrated,
        hasAssessment: data.hasAssessment,
        hasConstraints: data.hasConstraints,
      });
      void utils.program.getToday.invalidate();
      void utils.constraints.getCurrent.invalidate();
      void utils.assessment.state.invalidate();
      void utils.import.recentGames.invalidate();
    },
    onError: () => {
      // Retain guest session in storage if server migration encounters an error.
      // Do not reset syncAttemptedRef to avoid repeated 401/network requests.
    },
  });

  useEffect(() => {
    if (syncAttemptedRef.current) return;
    if (!hasGuestData()) return;

    syncAttemptedRef.current = true;
    const guestData = getGuestSession();

    migrateMutation.mutate({
      baseline: guestData.baseline
        ? {
            username: guestData.baseline.username,
            platform: guestData.baseline.platform,
            tacticalRatingEstimate: guestData.baseline.tacticalRatingEstimate,
            uncertainty: guestData.baseline.uncertainty,
            topBlindspot: guestData.baseline.topBlindspot,
          }
        : null,
      constraints: guestData.constraints
        ? {
            minutesPerDay: guestData.constraints.minutesPerDay,
            daysPerWeek: guestData.constraints.daysPerWeek,
            formatPrefs: guestData.constraints.formatPrefs,
            goals: guestData.constraints.goals,
            ownedResources: guestData.constraints.ownedResources,
          }
        : null,
      program: guestData.program
        ? {
            methodologyVersion: guestData.program.methodologyVersion,
            items: guestData.program.items.map((it) => ({
              id: it.id,
              orderIndex: it.orderIndex,
              activityId: it.activityId,
              activityType: it.activityType,
              params: it.params,
              dimensionsTargeted: it.dimensionsTargeted,
              rationaleKey: it.rationaleKey,
              rationaleText: it.rationaleText,
              evidenceGrade: it.evidenceGrade,
              evidenceTier: it.evidenceTier,
              citationKey: it.citationKey,
              confidence: it.confidence,
              soften: it.soften,
              status: it.status,
            })),
          }
        : null,
      activityEvents: guestData.activityEvents.map((evt) => ({
        type: evt.type,
        occurredAt: evt.occurredAt,
        programItemId: evt.programItemId,
        payload: evt.payload,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
