"use client";

// Data ownership controls (VISION §7): export your data as JSON, or erase your account.
// Both are user-initiated and explicit — no dark patterns. Delete is double-confirmed.

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { signOutAction } from "@/server/auth-actions";

export function AccountActions() {
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const del = trpc.account.deleteAccount.useMutation({
    onSuccess: () => {
      // Soft-deleted server-side; sign out (redirects to "/").
      void signOutAction();
    },
    onError: (e) => setError(e.message),
  });

  async function exportData() {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await utils.account.exportData.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mainline-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Your JSON export is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section id="data" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="eyebrow border-b border-line/80 pb-3">Your data</h2>
      <p className="text-graphite text-sm leading-relaxed font-serif">
        Your data is yours. Export everything Mainline holds about you, or erase
        your account entirely. We never sell or share your data (VISION §7).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportData()}
          disabled={exporting}
        >
          {exporting ? "Preparing…" : "Export my data (JSON)"}
        </Button>

        {!confirming ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setError(null);
              setNotice(null);
              setConfirming(true);
            }}
          >
            Delete my account
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <StatusMessage tone="error" className="basis-full">
              This permanently erases your account, connections, and training
              data. This cannot be undone.
            </StatusMessage>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => del.mutate()}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Yes, delete everything"}
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

      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>
  );
}
