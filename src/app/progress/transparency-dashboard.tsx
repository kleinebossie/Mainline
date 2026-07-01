"use client";

import { trpc } from "@/lib/trpc/react";

export function TransparencyDashboard() {
  const skillStates = trpc.tracker.skillStates.useQuery();
  const dueStates = trpc.tracker.dueScheduleStates.useQuery();
  const adaptationLogs = trpc.tracker.adaptationLogs.useQuery();

  return (
    <div className="flex flex-col gap-12 mt-4">
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">
          Skill Estimates
        </h2>
        {skillStates.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading skills…</p>
        ) : skillStates.data && skillStates.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {skillStates.data.map((s) => (
              <div
                key={s.dimension}
                className="bg-card rounded-lg border p-4 shadow-sheet"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-serif text-base font-semibold">
                    {s.dimension}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                    {Math.round(s.estimate)} ±{Math.round(s.uncertainty)}
                  </span>
                </div>
                <div className="text-graphite font-mono text-[0.7rem] uppercase tracking-wider mt-2">
                  Based on {s.sampleSize} interactions
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-graphite text-sm">
            No skill estimates yet. Complete puzzles to build your profile.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">
          Schedule & Due Items
        </h2>
        {dueStates.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading schedule…</p>
        ) : dueStates.data && dueStates.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {dueStates.data.map((d, i) => (
              <li
                key={`${d.itemType}-${d.itemRef}-${i}`}
                className="bg-card flex items-center justify-between gap-4 rounded-md border p-3.5"
              >
                <span className="font-serif text-base font-medium">
                  {d.itemType}: {d.itemRef}
                </span>
                <span className="text-graphite font-mono text-xs tabular-nums">
                  Due {new Date(d.due).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm">No due items right now.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">Adaptation Log</h2>
        {adaptationLogs.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading logs…</p>
        ) : adaptationLogs.data && adaptationLogs.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {adaptationLogs.data.map((log) => (
              <li
                key={log.id}
                className="bg-card flex flex-col gap-2 rounded-md border p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracking-wide text-ink font-semibold">
                    {log.trigger}
                  </span>
                  <span className="text-graphite font-mono text-xs">
                    {new Date(log.runAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-graphite font-mono text-[0.75rem]">
                  Methodology: {log.methodologyVersion}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm">No engine adaptations yet.</p>
        )}
      </section>


    </div>
  );
}
