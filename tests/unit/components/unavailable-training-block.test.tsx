import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UnavailableTrainingBlock } from "@/app/train/[itemId]/unavailable-training-block";

describe("UnavailableTrainingBlock", () => {
  it("offers an honest skip instead of claiming empty work was completed", () => {
    const html = renderToStaticMarkup(
      <UnavailableTrainingBlock
        error={null}
        pending={false}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("This block has no positions left to train.");
    expect(html).toContain("without counting as completed training");
    expect(html).toContain("Skip unavailable block");
    expect(html).not.toContain("Session complete");
  });

  it("blocks repeat actions while the skip is being saved", () => {
    const html = renderToStaticMarkup(
      <UnavailableTrainingBlock
        error={new Error("save failed")}
        pending
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("Block not closed");
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("Closing block...");
  });
});
