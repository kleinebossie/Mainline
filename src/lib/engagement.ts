// Engagement boundary types (BUILD.md §5.7, §9). Shared by the dashboard client, the tRPC
// router, and the JSON typing — one validation truth (BUILD.md §3), like lib/tracker.ts.
//
// L1: these are RAW preference inputs (which channel, how often, on/off). The CAP that bounds
// `cadenceCap` is a methodology number (Seam 9 reminderCadenceCapPerDay), applied by the
// Engine (engine/events.clampReminderCadence) before write — never hardcoded here. The bound
// below is only an input-sanity ceiling.

import { z } from "zod";

/** Reminder channels (Phase 1: reminders are off by default; only "none" is built out). */
export const NOTIFICATION_CHANNELS = ["none", "email", "push"] as const;

/** The tRPC input for saving reminder preferences. `cadenceCap` is the user's requested
 *  reminders/day; the server clamps it to the Seam-9 config ceiling before persisting. */
export const notificationPrefInputSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  // Input-sanity ceiling only (24/day); the real cap is the config's reminderCadenceCapPerDay.
  cadenceCap: z.number().int().nonnegative().max(24),
  enabled: z.boolean(),
  quietHours: z.string().max(40).optional(),
});
export type NotificationPrefInput = z.infer<typeof notificationPrefInputSchema>;
