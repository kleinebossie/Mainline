import * as Sentry from "@sentry/nextjs";

import {
  scrubMonitoringBreadcrumb,
  scrubMonitoringEvent,
} from "@/lib/monitoring-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubMonitoringEvent,
  beforeBreadcrumb: scrubMonitoringBreadcrumb,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
