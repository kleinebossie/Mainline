"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { ErrorNotice } from "@/components/ui/error-notice";

function utcDay(value: string, fallback: string): Date {
  return new Date(`${value || fallback}T00:00:00.000Z`);
}

export function OperationsPanel() {
  const [researchFrom, setResearchFrom] = useState("");
  const [researchTo, setResearchTo] = useState("");
  const validResearchWindow = Boolean(researchFrom && researchTo);
  const researchExport = trpc.research.controlledExport.useQuery(
    {
      from: utcDay(researchFrom, "1970-01-01"),
      to: utcDay(researchTo, "1970-01-02"),
      maxRecords: 500,
    },
    { enabled: false, retry: false },
  );
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

      <div className="bg-card mt-4 flex flex-col gap-3 rounded-md border p-4">
        <div>
          <p className="font-mono text-xs font-semibold">
            Controlled observational export
          </p>
          <p className="text-graphite mt-1 text-xs leading-relaxed">
            Includes only users consented under the current notice. Rows are
            pseudonymized and support association analysis only, never causal
            claims or automatic methodology changes.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-graphite flex flex-col gap-1 font-mono text-xs">
            From date, inclusive (UTC)
            <input
              className="bg-paper rounded-md border px-2 py-1.5"
              onChange={(event) => setResearchFrom(event.target.value)}
              type="date"
              value={researchFrom}
            />
          </label>
          <label className="text-graphite flex flex-col gap-1 font-mono text-xs">
            To date, exclusive (UTC)
            <input
              className="bg-paper rounded-md border px-2 py-1.5"
              onChange={(event) => setResearchTo(event.target.value)}
              type="date"
              value={researchTo}
            />
          </label>
        </div>
        <button
          className="self-start rounded-md border px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          disabled={!validResearchWindow || researchExport.isFetching}
          onClick={async () => {
            const result = await researchExport.refetch();
            if (!result.data) return;
            const blob = new Blob([JSON.stringify(result.data, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "mainline-controlled-research.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          type="button"
        >
          {researchExport.isFetching ? "Preparing..." : "Export consented rows"}
        </button>
        {researchExport.error && (
          <ErrorNotice
            error={researchExport.error}
            heading="Research export unavailable"
            message="The consent gate, date window, or export configuration prevented this request."
          />
        )}
        {researchExport.data && (
          <p className="text-graphite font-mono text-xs">
            {researchExport.data.metadata.returnedRecords} rows prepared.{" "}
            {researchExport.data.metadata.truncated
              ? "The result reached its explicit limit."
              : "The result was not truncated."}
          </p>
        )}
      </div>
    </section>
  );
}
