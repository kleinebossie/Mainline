// Raw reminder preferences. Methodology supplies the effective cadence cap.

import { z } from "zod";

const NOTIFICATION_CHANNELS = ["none", "email", "push"] as const;

export const notificationPrefInputSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  // Input-sanity ceiling only. The methodology cap is applied before persistence.
  cadenceCap: z.number().int().nonnegative().max(24),
  enabled: z.boolean(),
  quietHours: z.string().max(40).optional(),
});
export type NotificationPrefInput = z.infer<typeof notificationPrefInputSchema>;
