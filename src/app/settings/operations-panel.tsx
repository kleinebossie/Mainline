"use client";

import { trpc } from "@/lib/trpc/react";

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
          className="rounded-md border px-3 py-1.5 font-mono text-xs"
          onClick={() => jobs.refetch()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {jobs.isLoading && <p className="text-sm">Loading job status...</p>}
      {jobs.error && (
        <p className="text-clay text-sm">Job status is unavailable.</p>
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
            {job.status === "error" && (
              <button
                className="rounded-md border px-3 py-1.5 font-mono text-xs disabled:opacity-50"
                disabled={retry.isPending}
                onClick={() => retry.mutate({ id: job.id })}
                type="button"
              >
                Retry
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
