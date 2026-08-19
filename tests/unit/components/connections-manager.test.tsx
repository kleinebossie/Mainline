import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock TRPC react hooks for static rendering
const mockListQuery = vi.fn();

vi.mock("@/lib/trpc/react", () => ({
  trpc: {
    connections: {
      list: {
        useQuery: () => mockListQuery(),
      },
      addLichessUsername: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      addChessComUsername: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      disconnect: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    useUtils: () => ({
      connections: {
        list: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSession: () => ({
    connections: [],
  }),
  saveGuestConnection: vi.fn(),
  removeGuestConnection: vi.fn(),
}));

import { ConnectionsManager } from "@/app/connections/connections-manager";

describe("ConnectionsManager", () => {
  it("renders locked calibration button and skip link when no accounts connected", () => {
    mockListQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [],
    });

    const html = renderToStaticMarkup(<ConnectionsManager />);

    expect(html).toContain("No accounts connected");
    expect(html).toContain("Continue to calibration");
    expect(html).toContain("Locked");
    expect(html).toContain("Connect an account above to unlock calibration.");
    expect(html).toContain("disabled");
    expect(html).toContain("Skip connecting accounts and go to Today →");
  });

  it("renders active calibration link when accounts are connected", () => {
    mockListQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        {
          id: "conn-1",
          platform: "lichess",
          externalUsername: "testuser",
          status: "active",
        },
      ],
    });

    const html = renderToStaticMarkup(<ConnectionsManager />);

    expect(html).toContain("Lichess");
    expect(html).toContain("testuser");
    expect(html).toContain("Continue to calibration →");
    expect(html).toContain('href="/onboarding/calibration"');
    expect(html).not.toContain("Connect an account above to unlock calibration.");
  });
});
