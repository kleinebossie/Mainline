"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { trpc } from "@/lib/trpc/react";
import { signOutAction } from "@/server/auth-actions";

export function AccountActions() {
  const utils = trpc.useUtils();
  const consent = trpc.account.researchConsent.useQuery();
  const [affirmOptional, setAffirmOptional] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const grant = trpc.account.grantResearchConsent.useMutation({
    onSuccess: async () => {
      setAffirmOptional(false);
      setNotice("Optional research consent recorded.");
      await consent.refetch();
    },
    onError: (e) => setError(e.message),
  });
  const withdraw = trpc.account.withdrawResearchConsent.useMutation({
    onSuccess: async () => {
      setNotice(
        "Consent withdrawn. Future optional secondary inclusion is stopped.",
      );
      await consent.refetch();
    },
    onError: (e) => setError(e.message),
  });
  const del = trpc.account.deleteAccount.useMutation({
    onSuccess: () => void signOutAction(),
    onError: (e) => setError(e.message),
  });

  const isEligible = consent.data?.isEligible ?? false;
  const hasActiveGrant = consent.data?.hasActiveGrant ?? false;
  const isOutdated = hasActiveGrant && !isEligible;
  const loadedNotice = consent.isSuccess ? consent.data.notice : undefined;

  async function exportData() {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await utils.account.exportData.fetch();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mainline-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Your JSON export is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section id="data" className="flex flex-col gap-7 scroll-mt-20">
      <div className="flex flex-col gap-3">
        <h2 className="eyebrow border-line/80 border-b pb-3">
          Privacy and your data
        </h2>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Mainline stores account and connection metadata, imported games,
          analysis measurements, constraints, programs, activity history,
          learning state, and the immutable skill-state history that lets the
          program remember your trajectory. Each program also snapshots the
          decision input it ran on, so any past session can be re-derived
          exactly, and your optional training-fit preferences travel with it.
          Programs and explanations snapshot the methodology version used, so
          later methodology changes do not rewrite your history.
        </p>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Personal training works without research consent. Operational records
          are still needed to deliver the service. They remain until you delete
          your account.
        </p>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-md border p-5">
        <div>
          <h3 className="font-serif text-lg">
            Optional aggregate observational research
          </h3>
          <p className="text-graphite mt-2 text-sm leading-relaxed">
            {consent.data?.notice.summary ?? "Loading the current notice."}
          </p>
        </div>
        <p className="font-mono text-xs">
          Notice: {consent.data?.notice.id ?? "Loading"} · Status:{" "}
          {isEligible
            ? "consented"
            : isOutdated
              ? "outdated consent, not eligible"
              : "not consented"}
        </p>
        {!isEligible && (
          <>
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={affirmOptional}
                className="mt-1"
                disabled={!loadedNotice}
                onChange={(event) => setAffirmOptional(event.target.checked)}
                type="checkbox"
              />
              <span>
                I voluntarily opt in to the scope described above. This is not
                required for training.
              </span>
            </label>
            <Button
              className="self-start"
              disabled={!loadedNotice || !affirmOptional || grant.isPending}
              onClick={() => {
                if (!loadedNotice) return;
                grant.mutate({
                  affirmOptional: true,
                  displayedNoticeVersion: loadedNotice.id,
                });
              }}
              type="button"
            >
              Record optional consent
            </Button>
          </>
        )}
        {hasActiveGrant && (
          <div>
            <Button
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate()}
              type="button"
              variant="outline"
            >
              Withdraw research consent
            </Button>
            <p className="text-graphite mt-2 text-xs">
              {isOutdated
                ? "Your earlier consent does not apply to this notice. You can withdraw it or separately opt in above."
                : consent.data?.notice.withdrawal}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            {exporting ? "Preparing..." : "Export my data (JSON)"}
          </Button>
          {!confirming ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <StatusMessage tone="error" className="basis-full">
                This queues a retryable hard erase of your account, local
                credentials, connections, and training data. It cannot be
                undone.
              </StatusMessage>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => del.mutate()}
                disabled={del.isPending}
              >
                {del.isPending ? "Queuing erase..." : "Yes, permanently erase"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={del.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
        <p className="text-graphite text-xs">
          This product copy is a roadmap implementation, not legal advice. The
          owner must complete legal and privacy-copy review before any secondary
          research capture is enabled.
        </p>
      </div>
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>
  );
}
