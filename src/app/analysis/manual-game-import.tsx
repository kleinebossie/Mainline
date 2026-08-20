"use client";

import { useState, type ChangeEvent } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import {
  MANUAL_PGN_MAX_BATCH_BYTES,
  MANUAL_PGN_MAX_GAMES,
  type ManualGameImportInput,
} from "@/lib/manual-import";
import { errorMessage } from "@/lib/error-presentation";
import { isGuestSession } from "@/lib/guest-session";
import { trpc } from "@/lib/trpc/react";
import type { AppRouter } from "@/server/routers/_app";

type PreviewOutput = inferRouterOutputs<AppRouter>["import"]["manualPreview"];
type PreviewEntry = Extract<PreviewOutput, { ok: true }>["entries"][number];
type ValidPreview = Extract<PreviewEntry, { status: "valid" }>;

interface GameDraft {
  color: "" | "w" | "b";
  playedDate: string;
  timeControl: string;
  result: "" | "win" | "loss" | "draw";
  userRating: string;
  opponentRating: string;
  event: string;
}

function dateInputValue(value: string | undefined): string {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(value ?? "")
    ? value!.replaceAll(".", "-")
    : "";
}

function initialDraft(entry: ValidPreview): GameDraft {
  return {
    color: "",
    playedDate: dateInputValue(entry.metadata.date ?? entry.metadata.utcDate),
    timeControl: entry.metadata.timeControl ?? "",
    result: "",
    userRating: "",
    opponentRating: "",
    event: entry.metadata.event ?? "",
  };
}

function optionalInteger(value: string): number | undefined {
  return /^\d{1,4}$/.test(value) ? Number(value) : undefined;
}

function importedResultLabel(
  result: string | undefined,
  color: GameDraft["color"],
): string {
  if (!color || !result || result === "*") return "Unknown";
  if (result === "1/2-1/2") return "Draw";
  if (result !== "1-0" && result !== "0-1") return "Unknown";
  const whiteWon = result === "1-0";
  return whiteWon === (color === "w") ? "Win" : "Loss";
}

function ratingPlaceholder(
  entry: ValidPreview,
  draft: GameDraft,
  side: "user" | "opponent",
): string {
  if (!draft.color) return "Optional";
  const userIsWhite = draft.color === "w";
  const value =
    side === "user"
      ? userIsWhite
        ? entry.metadata.whiteElo
        : entry.metadata.blackElo
      : userIsWhite
        ? entry.metadata.blackElo
        : entry.metadata.whiteElo;
  return value ? `PGN: ${value}` : "Optional";
}

function toImportInput(index: number, draft: GameDraft): ManualGameImportInput {
  return {
    index,
    color: draft.color || undefined,
    playedDate: draft.playedDate || undefined,
    timeControl: draft.timeControl.trim() || undefined,
    result: draft.result || undefined,
    userRating: optionalInteger(draft.userRating),
    opponentRating: optionalInteger(draft.opponentRating),
    event: draft.event.trim() || undefined,
  };
}

export function ManualGameImport({ onImported }: { onImported: () => void }) {
  const utils = trpc.useUtils();
  const [pgnText, setPgnText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, GameDraft>>({});

  const preview = trpc.import.manualPreview.useMutation({
    onSuccess: (result) => {
      if (!result.ok) {
        setDrafts({});
        return;
      }
      setDrafts(
        Object.fromEntries(
          result.entries.flatMap((entry) =>
            entry.status === "valid"
              ? [[entry.index, initialDraft(entry)] as const]
              : [],
          ),
        ),
      );
    },
  });
  const create = trpc.import.manualCreate.useMutation({
    onSuccess: async (result) => {
      if (result.ok && (result.imported > 0 || result.duplicates > 0)) {
        if (typeof window !== "undefined" && isGuestSession()) {
          try {
            const cached = localStorage.getItem("mainline_guest_games");
            const existingGames = cached ? JSON.parse(cached) : [];
            const newGames = validEntries.map((entry) => {
              const draft = drafts[entry.index];
              return {
                id: `guest_manual_${Date.now()}_${entry.index}`,
                pgn: pgnText,
                color: draft?.color ?? "w",
                platform: "manual",
                playedAt: draft?.playedDate ?? new Date().toISOString(),
                result: draft?.result ?? null,
                timeControl: draft?.timeControl ?? null,
                opening: entry.metadata.opening ?? null,
                opponent:
                  draft?.color === "w"
                    ? entry.metadata.black ?? "Opponent"
                    : entry.metadata.white ?? "Opponent",
                you:
                  draft?.color === "w"
                    ? entry.metadata.white ?? "You"
                    : entry.metadata.black ?? "You",
                analyzed: false,
              };
            });
            localStorage.setItem(
              "mainline_guest_games",
              JSON.stringify([...newGames, ...existingGames]),
            );
          } catch {
            // Ignore storage errors.
          }
        }
        await Promise.all([
          utils.analysis.library.invalidate(),
          utils.analysis.pending.invalidate(),
          utils.analysis.summary.invalidate(),
          utils.import.recentGames.invalidate(),
        ]);
        onImported();
      }
    },
  });

  function replaceText(value: string, nextFileName: string | null = null) {
    setPgnText(value);
    setFileName(nextFileName);
    setFileError(null);
    setDrafts({});
    preview.reset();
    create.reset();
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MANUAL_PGN_MAX_BATCH_BYTES) {
      setFileError(
        `Choose a PGN file no larger than ${MANUAL_PGN_MAX_BATCH_BYTES / 1024} KiB.`,
      );
      return;
    }
    try {
      replaceText(await file.text(), file.name);
    } catch {
      setFileError("This file could not be read. Choose another PGN file.");
    }
  }

  function updateDraft(index: number, patch: Partial<GameDraft>) {
    setDrafts((current) => ({
      ...current,
      [index]: { ...current[index]!, ...patch },
    }));
    create.reset();
  }

  const parsed = preview.data?.ok ? preview.data : null;
  const validEntries =
    parsed?.entries.filter(
      (entry): entry is ValidPreview => entry.status === "valid",
    ) ?? [];
  const missingColor = validEntries.some(
    (entry) => !drafts[entry.index]?.color,
  );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="manual-pgn-heading"
    >
      <div className="flex flex-col gap-1 border-b border-line/80 pb-3">
        <h2 id="manual-pgn-heading" className="eyebrow">
          Add a game from PGN
        </h2>
        <p className="font-serif text-sm leading-relaxed text-graphite">
          Paste one game or choose a PGN file with up to {MANUAL_PGN_MAX_GAMES}{" "}
          games. Each valid game is imported separately, then uses the same
          browser scan and review flow.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="manual-pgn-file"
                className="font-mono text-xs font-semibold text-ink"
              >
                PGN file
              </label>
              <Input
                id="manual-pgn-file"
                type="file"
                accept=".pgn,application/x-chess-pgn,text/plain"
                onChange={(event) => void chooseFile(event)}
              />
            </div>
            <span className="pb-2 font-mono text-[0.68rem] text-graphite">
              Maximum {MANUAL_PGN_MAX_BATCH_BYTES / 1024} KiB
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manual-pgn-text"
              className="font-mono text-xs font-semibold text-ink"
            >
              Or paste PGN
            </label>
            <Textarea
              id="manual-pgn-text"
              value={pgnText}
              rows={8}
              placeholder={
                '[Event "Club game"]\n[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 ...'
              }
              onChange={(event) => replaceText(event.target.value)}
            />
            {fileName && (
              <span className="font-mono text-[0.68rem] text-graphite">
                Loaded {fileName}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={preview.isPending || pgnText.trim().length === 0}
              onClick={() => preview.mutate(pgnText)}
            >
              {preview.isPending ? "Checking PGN…" : "Check games"}
            </Button>
            <span className="font-serif text-xs text-graphite">
              Standard chess only. Missing dates, ratings, and clocks stay
              unknown.
            </span>
          </div>
        </CardContent>
      </Card>

      {fileError && <StatusMessage tone="error">{fileError}</StatusMessage>}
      {preview.error && (
        <ErrorNotice
          error={preview.error}
          heading="PGN not checked"
          message={errorMessage(
            preview.error,
            "The PGN could not be checked. Try a smaller file or paste it again.",
          )}
          onRetry={() => preview.mutate(pgnText)}
          retrying={preview.isPending}
          retryLabel="Check again"
        />
      )}
      {preview.data && !preview.data.ok && (
        <StatusMessage tone="error" heading="PGN not accepted">
          {preview.data.message}
        </StatusMessage>
      )}

      {parsed && (
        <div className="flex flex-col gap-3">
          {parsed.entries.map((entry) => {
            if (entry.status !== "valid") {
              return (
                <div
                  key={entry.index}
                  className="rounded-lg border border-clay/30 bg-clay/5 px-4 py-3"
                >
                  <p className="font-mono text-xs font-semibold text-ink">
                    Game {entry.index + 1}
                  </p>
                  <p className="mt-1 font-serif text-sm text-graphite">
                    {entry.message}
                  </p>
                </div>
              );
            }

            const draft = drafts[entry.index] ?? initialDraft(entry);
            return (
              <div
                key={entry.index}
                className="rounded-lg border border-line bg-card px-4 py-4 shadow-sheet"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wide text-evergreen">
                      Game {entry.index + 1} · {entry.plyCount} plies
                    </p>
                    <p className="mt-1 font-serif text-base font-semibold text-ink">
                      {entry.metadata.white ?? "White"} vs{" "}
                      {entry.metadata.black ?? "Black"}
                    </p>
                    <p className="font-serif text-xs text-graphite">
                      {[
                        entry.metadata.event,
                        entry.metadata.date ?? entry.metadata.utcDate,
                        entry.metadata.timeControl,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No event details in this PGN"}
                    </p>
                  </div>
                  <div className="w-full sm:w-52">
                    <label
                      htmlFor={`manual-color-${entry.index}`}
                      className="font-mono text-xs font-semibold text-ink"
                    >
                      You played
                    </label>
                    <Select
                      id={`manual-color-${entry.index}`}
                      className="mt-1"
                      value={draft.color}
                      aria-invalid={!draft.color}
                      onChange={(event) =>
                        updateDraft(entry.index, {
                          color: event.target.value as GameDraft["color"],
                        })
                      }
                    >
                      <option value="">Choose a color</option>
                      <option value="w">White</option>
                      <option value="b">Black</option>
                    </Select>
                  </div>
                </div>

                <details className="mt-4 border-t border-line/70 pt-3">
                  <summary className="cursor-pointer font-mono text-xs font-semibold text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Check optional game details
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Date
                      <Input
                        type="date"
                        value={draft.playedDate}
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            playedDate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Time control
                      <Input
                        value={draft.timeControl}
                        maxLength={64}
                        placeholder="Optional, for example 90+30"
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            timeControl: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Your result
                      <Select
                        value={draft.result}
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            result: event.target.value as GameDraft["result"],
                          })
                        }
                      >
                        <option value="">
                          Use PGN (
                          {importedResultLabel(
                            entry.metadata.result,
                            draft.color,
                          )}
                          )
                        </option>
                        <option value="win">Win</option>
                        <option value="draw">Draw</option>
                        <option value="loss">Loss</option>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Event
                      <Input
                        value={draft.event}
                        maxLength={200}
                        placeholder="Optional"
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            event: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Your rating
                      <Input
                        inputMode="numeric"
                        value={draft.userRating}
                        maxLength={4}
                        placeholder={ratingPlaceholder(entry, draft, "user")}
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            userRating: event.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-mono text-xs text-ink">
                      Opponent rating
                      <Input
                        inputMode="numeric"
                        value={draft.opponentRating}
                        maxLength={4}
                        placeholder={ratingPlaceholder(
                          entry,
                          draft,
                          "opponent",
                        )}
                        onChange={(event) =>
                          updateDraft(entry.index, {
                            opponentRating: event.target.value.replace(
                              /\D/g,
                              "",
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
              </div>
            );
          })}

          {validEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={create.isPending || missingColor}
                onClick={() =>
                  create.mutate({
                    pgnText,
                    games: validEntries.map((entry) =>
                      toImportInput(
                        entry.index,
                        drafts[entry.index] ?? initialDraft(entry),
                      ),
                    ),
                  })
                }
              >
                {create.isPending
                  ? "Importing games…"
                  : `Import ${validEntries.length} valid game${validEntries.length === 1 ? "" : "s"}`}
              </Button>
              {missingColor && (
                <span className="font-serif text-xs text-clay">
                  Choose your color for every valid game.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {create.error && (
        <ErrorNotice
          error={create.error}
          heading="Games not imported"
          message={errorMessage(
            create.error,
            "The import did not finish. Check the game details and try again.",
          )}
          onRetry={() => {
            if (create.variables) create.mutate(create.variables);
          }}
          retrying={create.isPending}
          retryLabel="Try import again"
        />
      )}
      {create.data?.ok && (
        <StatusMessage
          tone={create.data.imported > 0 ? "success" : "neutral"}
          heading="Import finished"
        >
          Imported {create.data.imported}; already present{" "}
          {create.data.duplicates}. Rejected or unsupported games stayed out of
          your library.
        </StatusMessage>
      )}
    </section>
  );
}
