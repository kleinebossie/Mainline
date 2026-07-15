"use client";

import { trpc } from "@/lib/trpc/react";
import { ErrorNotice } from "@/components/ui/error-notice";

export function OperationsPanel() {
  const jobs = trpc.operations.recentJobs.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const retry = trpc.operations.retryJob.useMutation({
    onSuccess: () => jobs.refetch(),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="border-line/80 flex items-end justify-between border-b pb-3">
        <div>
          <h2 className="eyebrow">Operations</h2>
          <p className="text-graphite mt-2 text-sm">
            Safe job status only. Payloads and account data are not shown.
          </p>
        </div>
        <button
          className="rounded-md border px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          disabled={jobs.isFetching}
          onClick={() => void jobs.refetch()}
          type="button"
        >
          {jobs.isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {jobs.isLoading && <p className="text-sm">Loading job status...</p>}
      {jobs.error && (
        <ErrorNotice
          error={jobs.error}
          heading="Job status unavailable"
          message="Mainline could not load recent operations. Try the status list again."
          onRetry={() => void jobs.refetch()}
          retrying={jobs.isFetching}
          retryLabel="Reload job status"
        />
      )}
      {retry.error && (
        <ErrorNotice
          error={retry.error}
          heading="Job not retried"
          message="The job stayed in its previous state. Try the retry action again."
        />
      )}
      <div className="flex flex-col gap-2">
        {jobs.data?.map((job) => (
          <article
            className="bg-card grid gap-2 rounded-md border p-4 sm:grid-cols-[1fr_auto]"
            key={job.id}
          >
            <div>
              <p className="font-mono text-xs font-semibold">{job.kind}</p>
              <p className="text-graphite mt-1 font-mono text-[0.7rem]">
                {job.status} · attempt {job.attempt} ·{" "}
                {job.startedAt.toLocaleString()}
                {job.errorCode ? ` · ${job.errorCode}` : ""}
              </p>
            </div>
            {(job.status === "error" || job.status === "queued") && (
              <button
                className="rounded-md border px-3 py-1.5 font-mono text-xs disabled:opacity-50"
                disabled={retry.isPending}
                onClick={() => retry.mutate({ id: job.id })}
                type="button"
              >
                {retry.isPending && retry.variables?.id === job.id
                  ? "Retrying..."
                  : "Retry"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
