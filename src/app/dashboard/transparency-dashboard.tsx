"use client";

import { trpc } from "@/lib/trpc/react";
import { TransparencyCard } from "@/components/transparency-card";

export function TransparencyDashboard() {
  const skillStates = trpc.tracker.skillStates.useQuery();
  const dueStates = trpc.tracker.dueScheduleStates.useQuery();
  const adaptationLogs = trpc.tracker.adaptationLogs.useQuery();
  const expectation = trpc.program.bandExpectation.useQuery();

  return (
    <div className="flex flex-col gap-12 mt-8 border-t pt-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Skill Estimates</h2>
        {skillStates.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading skills…</p>
        ) : skillStates.data && skillStates.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {skillStates.data.map((s) => (
              <div
                key={s.dimension}
                className="rounded-md border p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.dimension}</span>
                  <span className="text-sm">
                    {Math.round(s.estimate)} ±{Math.round(s.uncertainty)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Based on {s.sampleSize} interactions
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No skill estimates yet. Complete puzzles to build your profile.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Schedule & Due Items</h2>
        {dueStates.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading schedule…</p>
        ) : dueStates.data && dueStates.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {dueStates.data.map((d, i) => (
              <li
                key={`${d.itemType}-${d.itemRef}-${i}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">
                  {d.itemType}: {d.itemRef}
                </span>
                <span className="text-muted-foreground">
                  Due {new Date(d.due).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No due items right now.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Adaptation Log</h2>
        {adaptationLogs.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading logs…</p>
        ) : adaptationLogs.data && adaptationLogs.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {adaptationLogs.data.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1 rounded-md border p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium uppercase tracking-wide text-xs">
                    {log.trigger}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.runAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1">
                  Methodology: {log.methodologyVersion}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No engine adaptations yet.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Expectations</h2>
        {expectation.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading expectations…</p>
        ) : expectation.data ? (
          <TransparencyCard
            rationaleText={expectation.data.text}
            evidenceGrade={expectation.data.evidenceGrade}
            evidenceTier={expectation.data.evidenceTier}
            citationKey={expectation.data.citationKey}
            confidence="low"
            soften={
              expectation.data.evidenceGrade === "C" ||
              expectation.data.evidenceGrade === "D"
            }
            flag={expectation.data.flag}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Could not load expectation for your level.
          </p>
        )}
      </section>
    </div>
  );
}
