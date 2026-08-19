// Standalone solvable puzzle and drill fixtures for guest training mode (BETA_PRIORITIZATION_PLAN.md §3.2).
// Allows guest visitors to complete real interactive drills in the browser without database dependencies.

import type { GuestProgramItem } from "@/lib/guest-session";

export interface GuestSolvable {
  kind: "puzzle" | "blunder_drill";
  id: string;
  fen: string;
  line: string[];
  rating: number | null;
  themes: string[];
}

export interface GuestTrainData {
  item: {
    id: string;
    orderIndex: number;
    activityId: string;
    activityType: string;
    label: string;
    params: Record<string, unknown>;
    rationaleText: string;
    evidenceGrade: string;
    evidenceTier: number;
    citationKey: string;
    citationSource: string | null;
    status: "pending" | "done" | "skipped";
    estMinutes: number | null;
    dimensionLabels: string[];
    reviewThemes: string[];
    externalUrl: string | null;
    externalLabel: string | null;
    url: string | null;
    delivery: "internal" | "external";
    bookResource: null;
    confidence: string;
    soften: boolean;
  };
  solvables: GuestSolvable[];
  redoFlow: {
    retestDelaySec: number;
    maxAttempts: number;
    hint: {
      enabled: boolean;
      delaySec: number;
      highlightMode: string;
      evidenceGrade: string;
      evidenceTier: number;
      citationKey: string;
      citationSource?: string;
    };
    retestRationaleText?: string;
    evidenceGrade?: string;
    evidenceTier?: number;
    citationKey?: string;
    citationSource?: string;
  };
  affordances: {
    showLegalMoveDots: boolean;
    allowArrows: boolean;
    allowHover: boolean;
    showEvalBar: boolean;
    restricted: boolean;
    restrictionRationaleKey: string;
  };
  restrictionRationale: string | null;
  nextItem: {
    id: string;
    orderIndex: number;
    label: string;
    url: string | null;
    externalUrl: string | null;
    delivery: "internal" | "external";
    activityType: string;
    estMinutes: number | null;
  } | null;
}

const GUEST_FIXTURES: Record<string, GuestSolvable[]> = {
  blunder_drill: [
    {
      kind: "blunder_drill",
      id: "guest_blunder_1",
      fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
      line: ["d1d8"],
      rating: 1400,
      themes: ["backRankMate"],
    },
    {
      kind: "blunder_drill",
      id: "guest_blunder_2",
      fen: "r1bqk2r/pppp1ppp/2n5/4p3/1b2n3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6",
      line: ["c3e4"],
      rating: 1450,
      themes: ["hangingPiece"],
    },
  ],
  tactics_drill: [
    {
      kind: "puzzle",
      id: "guest_puzzle_1",
      fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
      line: ["c4f7", "e8f7"],
      rating: 1400,
      themes: ["fork", "sacrifice"],
    },
    {
      kind: "puzzle",
      id: "guest_puzzle_2",
      fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1",
      line: ["a1a8"],
      rating: 1350,
      themes: ["backRankMate"],
    },
  ],
  spaced_review: [
    {
      kind: "puzzle",
      id: "guest_review_1",
      fen: "r1b1k2r/pppp1ppp/2n5/4p3/2B1P1nq/3P4/PPP2PPP/RNBQK2R w KQkq - 0 7",
      line: ["c4f7", "e8f7"],
      rating: 1450,
      themes: ["deflection"],
    },
  ],
};

/**
 * Return train data and interactive solvables for a guest program item.
 */
export function getGuestTrainItemData(item: GuestProgramItem): GuestTrainData {
  const isAnalysis =
    item.activityType === "analyse" ||
    item.activityType === "game_analysis" ||
    item.activityType === "review_games" ||
    item.activityType === "analyze_mistakes" ||
    item.activityId === "analyse_own_games" ||
    item.activityId === "game_analysis" ||
    item.activityId === "review_games" ||
    item.activityId === "analyze_mistakes";

  const solvables = isAnalysis
    ? []
    : (GUEST_FIXTURES[item.activityType] ??
      GUEST_FIXTURES[item.activityId] ??
      GUEST_FIXTURES.tactics_drill!);

  return {
    item: {
      id: item.id,
      orderIndex: item.orderIndex,
      activityId: item.activityId,
      activityType: item.activityType,
      label: item.label,
      params: item.params,
      rationaleText: item.rationaleText,
      evidenceGrade: item.evidenceGrade,
      evidenceTier: item.evidenceTier,
      citationKey: item.citationKey,
      citationSource: "Mainline Methodology",
      confidence: item.confidence ?? "high",
      soften: Boolean(item.soften),
      status: item.status,
      estMinutes: item.estMinutes,
      dimensionLabels: item.dimensionsTargeted ?? [],
      reviewThemes: [],
      externalUrl: null,
      externalLabel: null,
      url: `/train/${item.id}`,
      delivery: "internal",
      bookResource: null,
    },
    solvables,
    redoFlow: {
      retestDelaySec: 3,
      maxAttempts: 2,
      hint: {
        enabled: true,
        delaySec: 15,
        highlightMode: "piece",
        evidenceGrade: "A",
        evidenceTier: 1,
        citationKey: "ericsson_1993",
        citationSource: "The Role of Deliberate Practice",
      },
      retestRationaleText:
        "Retesting spaced items builds durable retrieval pathways.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "de_groot_1965",
      citationSource: "Thought and Choice in Chess",
    },
    affordances: {
      showLegalMoveDots: true,
      allowArrows: true,
      allowHover: true,
      showEvalBar: false,
      restricted: false,
      restrictionRationaleKey: "affordance_restriction",
    },
    restrictionRationale: null,
    nextItem: null,
  };
}
