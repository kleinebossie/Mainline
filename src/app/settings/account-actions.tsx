"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatusMessage } from "@/components/ui/status-message";
import { errorMessage } from "@/lib/error-presentation";
import { trpc } from "@/lib/trpc/react";
import { signOutAction } from "@/server/auth-actions";
import {
  clearGuestSession,
  getGuestSession,
  hasGuestData,
} from "@/lib/guest-session";

export function AccountActions() {
  const utils = trpc.useUtils();
  const consent = trpc.account.researchConsent.useQuery();
  const [hasGuestBrowserData, setHasGuestBrowserData] = useState(false);
  const [affirmOptional, setAffirmOptional] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setHasGuestBrowserData(hasGuestData());
  }, []);

  const grant = trpc.account.grantResearchConsent.useMutation({
    onSuccess: async () => {
      setAffirmOptional(false);
      setNotice("Optional research consent recorded.");
      await consent.refetch();
    },
    onError: (e) =>
      setError(
        errorMessage(e, "Research consent was not recorded. Try again."),
      ),
  });
  const withdraw = trpc.account.withdrawResearchConsent.useMutation({
    onSuccess: async () => {
      setNotice(
        "Consent withdrawn. Future optional secondary inclusion is stopped.",
      );
      await consent.refetch();
    },
    onError: (e) =>
      setError(
        errorMessage(e, "Research consent was not withdrawn. Try again."),
      ),
  });
  const del = trpc.account.deleteAccount.useMutation({
    onSuccess: () => void signOutAction(),
    onError: (e) =>
      setError(
        errorMessage(
          e,
          "Account deletion was not requested. Your account is unchanged. Try again.",
        ),
      ),
  });

  const isEligible = consent.data?.isEligible ?? false;
  const hasActiveGrant = consent.data?.hasActiveGrant ?? false;
  const isOutdated = hasActiveGrant && !isEligible;
  const loadedNotice = consent.isSuccess ? consent.data.notice : undefined;
  const isGuestMode = !loadedNotice;

  async function exportData() {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      let exportPayload: unknown;
      const currentGuest = getGuestSession();

      try {
        const serverData = await utils.account.exportData.fetch();
        if (serverData && !("guestMode" in serverData)) {
          exportPayload = serverData;
        } else {
          exportPayload = {
            exportedAt: new Date().toISOString(),
            guestMode: true,
            version: "mainline-guest-v1",
            guestSession: currentGuest,
            guestGames:
              typeof window !== "undefined"
                ? JSON.parse(
                    localStorage.getItem("mainline_guest_games") || "[]",
                  )
                : [],
          };
        }
      } catch {
        exportPayload = {
          exportedAt: new Date().toISOString(),
          guestMode: true,
          version: "mainline-guest-v1",
          guestSession: currentGuest,
          guestGames:
            typeof window !== "undefined"
              ? JSON.parse(localStorage.getItem("mainline_guest_games") || "[]")
              : [],
        };
      }

      const url = URL.createObjectURL(
        new Blob([JSON.stringify(exportPayload, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mainline-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Your JSON export is ready.");
    } catch (e) {
      setError(
        errorMessage(
          e,
          "Your export was not created. Your data is unchanged. Try again.",
        ),
      );
    } finally {
      setExporting(false);
    }
  }

  function handleResetGuest() {
    clearGuestSession();
    if (typeof window !== "undefined") {
      localStorage.removeItem("mainline_guest_games");
      localStorage.removeItem("mainline_seen_analysis_intro");
      window.location.href = "/";
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
          learning state, immutable skill-state history, weekly focus decisions,
          availability, forecasts, and the program revision ledger. Each program
          also snapshots the decision input it ran on, so any past session can
          be re-derived exactly.
        </p>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Personal training works without research consent. Operational records
          are still needed to deliver the service. They remain until you delete
          your account or clear your local guest session.
        </p>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-md border p-5">
        {isGuestMode ? (
          <div>
            <h3 className="font-serif text-lg">
              Optional aggregate observational research
            </h3>
            <p className="text-graphite mt-2 text-sm leading-relaxed font-serif">
              Research participation and multi-device sync are available when you
              sign in with your Lichess account. Personal training and local
              progress never require sign-in or research consent.
            </p>
            <div className="pt-3">
              <Link
                href="/signin"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Sign in with Lichess →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {consent.error && (
              <ErrorNotice
                error={consent.error}
                heading="Research settings unavailable"
                message="Mainline could not load your current consent status. No consent change can be made until it is reloaded."
                onRetry={() => void consent.refetch()}
                retrying={consent.isFetching}
                retryLabel="Reload consent status"
              />
            )}
            <div>
              <h3 className="font-serif text-lg">
                Optional aggregate observational research
              </h3>
              <p className="text-graphite mt-2 text-sm leading-relaxed">
                {consent.error
                  ? "Consent status was not loaded. No consent change is available until it reloads."
                  : (consent.data?.notice?.summary ??
                    "Loading the current notice.")}
              </p>
            </div>
            <p className="font-mono text-xs">
              Notice:{" "}
              {consent.error
                ? "Unavailable"
                : (consent.data?.notice?.id ?? "Loading")}{" "}
              · Status:{" "}
              {consent.error
                ? "unavailable"
                : isEligible
                  ? "consented"
                  : isOutdated
                    ? "outdated consent, not eligible"
                    : "not consented"}
            </p>
            {!consent.error && !isEligible && loadedNotice && (
              <>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    id="affirmOptional"
                    name="affirmOptional"
                    checked={affirmOptional}
                    className="mt-1"
                    disabled={!loadedNotice}
                    onChange={(event) =>
                      setAffirmOptional(event.target.checked)
                    }
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
                  {grant.isPending
                    ? "Recording consent..."
                    : "Record optional consent"}
                </Button>
              </>
            )}
            {!consent.error && hasActiveGrant && (
              <div>
                <Button
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                  type="button"
                  variant="outline"
                >
                  {withdraw.isPending
                    ? "Withdrawing consent..."
                    : "Withdraw research consent"}
                </Button>
                <p className="text-graphite mt-2 text-xs">
                  {isOutdated
                    ? "Your earlier consent does not apply to this notice. You can withdraw it or separately opt in above."
                    : consent.data?.notice?.withdrawal}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {hasGuestBrowserData && !isGuestMode && (
        <div className="bg-card flex flex-col gap-4 rounded-md border p-5">
          <div>
            <h3 className="font-serif text-lg font-semibold">
              Local browser guest data
            </h3>
            <p className="text-graphite mt-1 text-sm font-serif leading-relaxed">
              This browser stores local guest training data. You are currently
              signed in to your cloud account. Mainline keeps your guest data and
              your account data separate so no progress is overwritten.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                clearGuestSession();
                setHasGuestBrowserData(false);
                setNotice("Local browser guest session cleared.");
              }}
            >
              Clear local browser guest data
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            {exporting
              ? "Preparing..."
              : isGuestMode
                ? "Export local data (JSON)"
                : "Export my data (JSON)"}
          </Button>

          {!confirming ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirming(true);
                setDeleteConfirmText("");
              }}
            >
              {isGuestMode ? "Reset guest session" : "Delete my account"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <StatusMessage tone="error" className="basis-full">
                {isGuestMode
                  ? "This will clear all local training progress, connected guest accounts, and game analyses stored in your browser."
                  : "This queues a hard erase of your account and training data. Type DELETE below to confirm."}
              </StatusMessage>
              {!isGuestMode && (
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  aria-label="Confirm account deletion"
                  className="h-9 rounded-md border border-clay/50 bg-paper-raised px-3 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() =>
                  isGuestMode ? handleResetGuest() : del.mutate()
                }
                disabled={
                  (!isGuestMode && deleteConfirmText !== "DELETE") ||
                  del.isPending
                }
              >
                {isGuestMode
                  ? "Clear local data"
                  : del.isPending
                    ? "Queuing erase..."
                    : "Permanently erase"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setDeleteConfirmText("");
                }}
                disabled={del.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
        <p className="text-graphite text-xs">
          This product copy is a roadmap implementation, not legal advice.
        </p>
      </div>
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>
  );
}
