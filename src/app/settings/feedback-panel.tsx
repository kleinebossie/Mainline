"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { TransparencyCard } from "@/components/transparency-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";

type Notice = { tone: "success" | "error"; text: string } | null;

export function FeedbackPanel() {
  const utils = trpc.useUtils();
  const trainingRequestId = useRef<string | null>(null);
  const productRequestId = useRef<string | null>(null);
  const settings = trpc.feedback.settings.useQuery();
  const [targetId, setTargetId] = useState("");
  const [source, setSource] = useState<
    "always_available" | "contextual" | "weekly_check_in"
  >("always_available");
  const [relevance, setRelevance] = useState<
    "relevant" | "neutral" | "not_relevant"
  >("neutral");
  const [enjoyment, setEnjoyment] = useState<
    "enjoyed" | "neutral" | "not_enjoyed"
  >("neutral");
  const [timeFit, setTimeFit] = useState<"too_short" | "fits" | "too_long">(
    "fits",
  );
  const [frictionTags, setFrictionTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [trainingNotice, setTrainingNotice] = useState<Notice>(null);
  const [productCategory, setProductCategory] = useState<
    "bug" | "confusing" | "idea" | "other"
  >("bug");
  const [productMessage, setProductMessage] = useState("");
  const [contactAllowed, setContactAllowed] = useState(false);
  const [productNotice, setProductNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!settings.data || targetId) return;
    const search = new URLSearchParams(window.location.search);
    const contextualItem = search.get("programItemId");
    const contextualSource = search.get("source");
    if (
      contextualItem &&
      settings.data.recentItems.some((item) => item.id === contextualItem)
    ) {
      setTargetId(contextualItem);
    } else if (settings.data.recentItems[0]) {
      setTargetId(settings.data.recentItems[0].id);
    } else if (settings.data.activeProgramId) {
      setTargetId(`program:${settings.data.activeProgramId}`);
    }
    if (contextualSource === "contextual") setSource("contextual");
    if (contextualSource === "weekly_check_in") {
      setSource("weekly_check_in");
    }
  }, [settings.data, targetId]);

  const submitTraining = trpc.feedback.submitTraining.useMutation();
  const submitProduct = trpc.feedback.submitProduct.useMutation();
  const setPreference = trpc.feedback.setPositivePreference.useMutation({
    onSuccess: () => void utils.feedback.settings.invalidate(),
  });
  const resetPreferences = trpc.feedback.resetPreferences.useMutation({
    onSuccess: async () => {
      await utils.feedback.settings.invalidate();
      setTrainingNotice({ tone: "success", text: "Training fit reset." });
    },
  });

  if (settings.isLoading) {
    return (
      <StatusMessage tone="loading">Loading feedback settings…</StatusMessage>
    );
  }
  if (settings.error || !settings.data) {
    return (
      <ErrorNotice
        error={settings.error}
        heading="Feedback settings unavailable"
        message="Mainline could not load feedback settings. Try again."
        onRetry={() => void settings.refetch()}
        retrying={settings.isFetching}
        retryLabel="Reload feedback settings"
      />
    );
  }

  const data = settings.data;
  const hasTarget = targetId.length > 0;

  async function onTrainingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrainingNotice(null);
    const item = data.recentItems.find(
      (candidate) => candidate.id === targetId,
    );
    const programId = item?.programId ?? targetId.replace(/^program:/, "");
    trainingRequestId.current ??= crypto.randomUUID();
    try {
      await submitTraining.mutateAsync({
        requestId: trainingRequestId.current,
        scope: item ? "item" : "program",
        source,
        programId,
        ...(item ? { programItemId: item.id } : {}),
        relevance,
        enjoyment,
        timeFit,
        frictionTags,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setComment("");
      setFrictionTags([]);
      trainingRequestId.current = null;
      setTrainingNotice({
        tone: "success",
        text: "Training feedback saved. The prescription itself was not weakened.",
      });
      await settings.refetch();
    } catch {
      setTrainingNotice({
        tone: "error",
        text: "Training feedback was not saved. Try again.",
      });
    }
  }

  async function onProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductNotice(null);
    productRequestId.current ??= crypto.randomUUID();
    try {
      await submitProduct.mutateAsync({
        requestId: productRequestId.current,
        category: productCategory,
        message: productMessage,
        routeContext:
          new URLSearchParams(window.location.search).get("feedbackFrom") ??
          window.location.pathname,
        contactAllowed,
      });
      setProductMessage("");
      productRequestId.current = null;
      setProductNotice({ tone: "success", text: "Product feedback sent." });
    } catch {
      setProductNotice({
        tone: "error",
        text: "Product feedback was not sent. Try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card id="training-fit" gutter="A" className="scroll-mt-24 p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Training fit</p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
              Tell us how delivery fit your life
            </h3>
            <p className="text-graphite mt-2 max-w-2xl text-sm leading-relaxed">
              Relevance, enjoyment, timing, and friction can help choose between
              equally valuable delivery options. They cannot remove due work,
              lower useful difficulty, or hide a measured weakness.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={onTrainingSubmit}>
            <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
              Training block
              <Select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Choose recent training
                </option>
                {data.activeProgramId && (
                  <option value={`program:${data.activeProgramId}`}>
                    This week overall
                  </option>
                )}
                {data.recentItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.activityType.replaceAll("_", " ")} · {item.status}
                  </option>
                ))}
              </Select>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
                Felt relevant
                <Select
                  value={relevance}
                  onChange={(event) =>
                    setRelevance(event.target.value as typeof relevance)
                  }
                >
                  <option value="relevant">Yes</option>
                  <option value="neutral">Not sure</option>
                  <option value="not_relevant">No</option>
                </Select>
              </label>
              <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
                Enjoyment
                <Select
                  value={enjoyment}
                  onChange={(event) =>
                    setEnjoyment(event.target.value as typeof enjoyment)
                  }
                >
                  <option value="enjoyed">Enjoyed it</option>
                  <option value="neutral">Neutral</option>
                  <option value="not_enjoyed">Did not enjoy it</option>
                </Select>
              </label>
              <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
                Time fit
                <Select
                  value={timeFit}
                  onChange={(event) =>
                    setTimeFit(event.target.value as typeof timeFit)
                  }
                >
                  <option value="too_short">Too short</option>
                  <option value="fits">Fit well</option>
                  <option value="too_long">Too long</option>
                </Select>
              </label>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="font-mono text-xs text-graphite">
                What got in the way? Optional
              </legend>
              <div className="flex flex-wrap gap-2">
                {data.frictionTags.map((tag) => {
                  const selected = frictionTags.includes(tag.value);
                  return (
                    <label
                      key={tag.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper/50 px-3 py-2 font-mono text-xs text-graphite"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setFrictionTags((current) =>
                            selected
                              ? current.filter((value) => value !== tag.value)
                              : [...current, tag.value],
                          )
                        }
                      />
                      {tag.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
              Anything else? Optional
              <Textarea
                value={comment}
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                placeholder="A short note about setup, clarity, or timing"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={!hasTarget || submitTraining.isPending}
              >
                {submitTraining.isPending
                  ? "Saving…"
                  : "Save training feedback"}
              </Button>
              <span className="font-mono text-xs text-graphite">
                {data.state.preferences.evidenceCount} fit response
                {data.state.preferences.evidenceCount === 1 ? "" : "s"} recorded
              </span>
            </div>
            {trainingNotice && (
              <StatusMessage tone={trainingNotice.tone}>
                {trainingNotice.text}
              </StatusMessage>
            )}
          </form>

          <div className="border-t border-line pt-5">
            <label className="flex max-w-md flex-col gap-2 font-mono text-xs text-graphite">
              Optional positive delivery preference
              <Select
                value={data.state.preferredActivity ?? ""}
                disabled={setPreference.isPending}
                onChange={(event) =>
                  setPreference.mutate({
                    activityType: event.target.value || null,
                  })
                }
              >
                <option value="">No pinned preference</option>
                {data.activities.map((activity) => (
                  <option
                    key={activity.activityType}
                    value={activity.activityType}
                  >
                    {activity.label}
                  </option>
                ))}
              </Select>
            </label>
            <p className="text-graphite mt-2 text-xs leading-relaxed">
              This only breaks a tie between activities the methodology already
              considers equally valuable.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-3"
              disabled={resetPreferences.isPending}
              onClick={() => resetPreferences.mutate()}
            >
              {resetPreferences.isPending ? "Resetting…" : "Reset training fit"}
            </Button>
          </div>

          <TransparencyCard
            rationaleText={data.boundary.text}
            evidenceGrade={data.boundary.grade}
            evidenceTier={data.boundary.tier}
            citationKey={data.boundary.citationKey}
            confidence="high"
            soften={data.boundary.soften}
            defaultCollapsed
          />
        </div>
      </Card>

      <Card id="product-feedback" className="scroll-mt-24 p-5 sm:p-6">
        <form className="flex flex-col gap-4" onSubmit={onProductSubmit}>
          <div>
            <p className="eyebrow">Product feedback</p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
              Report a problem or share an idea
            </h3>
            <p className="text-graphite mt-2 text-sm leading-relaxed">
              This goes to product improvement only. It never becomes training
              evidence or changes your program.
            </p>
          </div>
          <label className="flex max-w-sm flex-col gap-2 font-mono text-xs text-graphite">
            Category
            <Select
              value={productCategory}
              onChange={(event) =>
                setProductCategory(event.target.value as typeof productCategory)
              }
            >
              <option value="bug">Something is broken</option>
              <option value="confusing">Something is confusing</option>
              <option value="idea">Idea</option>
              <option value="other">Other</option>
            </Select>
          </label>
          <label className="flex flex-col gap-2 font-mono text-xs text-graphite">
            Message
            <Textarea
              required
              maxLength={2000}
              value={productMessage}
              onChange={(event) => setProductMessage(event.target.value)}
              placeholder="What happened, and what did you expect?"
            />
          </label>
          <label className="flex items-start gap-2 font-mono text-xs text-graphite">
            <input
              type="checkbox"
              checked={contactAllowed}
              onChange={(event) => setContactAllowed(event.target.checked)}
            />
            You may contact me about this feedback.
          </label>
          <Button
            type="submit"
            className="self-start"
            disabled={submitProduct.isPending || !productMessage.trim()}
          >
            {submitProduct.isPending ? "Sending…" : "Send product feedback"}
          </Button>
          {productNotice && (
            <StatusMessage tone={productNotice.tone}>
              {productNotice.text}
            </StatusMessage>
          )}
        </form>
      </Card>
    </div>
  );
}
