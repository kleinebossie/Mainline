import { describe, expect, it } from "vitest";

// Mocking the state transition logic from train-item.tsx
interface Puzzle {
  id: string;
  rating: number;
  themes: string[];
}

interface RedoSessionState {
  puzzles: Puzzle[];
  currentIdx: number;
  phase: "training" | "delay" | "retest" | "complete";
  firstTryPassed: boolean;
  retestQueue: Puzzle[];
  hintActive: boolean;
  highlightedSquares: string[];
  delayRemaining: number;
  logs: { puzzleId: string; correct: boolean }[];
}

function initSession(puzzles: Puzzle[]): RedoSessionState {
  return {
    puzzles,
    currentIdx: 0,
    phase: puzzles.length > 0 ? "training" : "complete",
    firstTryPassed: true,
    retestQueue: [],
    hintActive: false,
    highlightedSquares: [],
    delayRemaining: 600,
    logs: [],
  };
}

function processAttempt(
  state: RedoSessionState,
  correct: boolean,
  startSquare: string,
): RedoSessionState {
  const currentPuzzle = state.puzzles[state.currentIdx]!;
  const newLogs = [...state.logs];
  let newFirstTryPassed = state.firstTryPassed;
  const newRetestQueue = [...state.retestQueue];
  let newHintActive = state.hintActive;
  let newHighlightedSquares = [...state.highlightedSquares];

  if (state.phase === "training") {
    if (correct) {
      if (state.firstTryPassed) {
        newLogs.push({ puzzleId: currentPuzzle.id, correct: true });
      }
    } else {
      // First mistake
      if (state.firstTryPassed) {
        newFirstTryPassed = false;
        newLogs.push({ puzzleId: currentPuzzle.id, correct: false });
        newRetestQueue.push(currentPuzzle);
        newHighlightedSquares = [startSquare];
        newHintActive = true;
      }
    }
  } else if (state.phase === "retest") {
    const activeRetestList = state.retestQueue;
    const retestPuzzle = activeRetestList[state.currentIdx]!;
    expect(retestPuzzle).toBeDefined();
    if (correct) {
      // Retested correctly
    } else {
      // Retested incorrectly (carried over next day, etc.)
    }
  }

  return {
    ...state,
    firstTryPassed: newFirstTryPassed,
    retestQueue: newRetestQueue,
    hintActive: newHintActive,
    highlightedSquares: newHighlightedSquares,
    logs: newLogs,
  };
}

function processNext(state: RedoSessionState): RedoSessionState {
  const activeList =
    state.phase === "retest" ? state.retestQueue : state.puzzles;
  const nextIdx = state.currentIdx + 1;

  if (nextIdx < activeList.length) {
    return {
      ...state,
      currentIdx: nextIdx,
      firstTryPassed: true,
      hintActive: false,
      highlightedSquares: [],
    };
  } else {
    // End of batch
    if (state.phase === "training") {
      if (state.retestQueue.length > 0) {
        return {
          ...state,
          phase: "delay",
          delayRemaining: 600,
          currentIdx: 0,
        };
      } else {
        return {
          ...state,
          phase: "complete",
        };
      }
    } else {
      return {
        ...state,
        phase: "complete",
      };
    }
  }
}

describe("Redo Flow 3-phase state transitions", () => {
  it("implements the correct flow from training to delay to retest and completion", () => {
    const puzzles: Puzzle[] = [
      { id: "p1", rating: 1000, themes: ["fork"] },
      { id: "p2", rating: 1200, themes: ["pin"] },
    ];

    let state = initSession(puzzles);
    expect(state.phase).toBe("training");
    expect(state.currentIdx).toBe(0);

    // 1. Solve first puzzle on first attempt
    state = processAttempt(state, true, "e2");
    expect(state.logs).toEqual([{ puzzleId: "p1", correct: true }]);
    expect(state.retestQueue).toEqual([]);

    // Go to next puzzle
    state = processNext(state);
    expect(state.currentIdx).toBe(1);
    expect(state.phase).toBe("training");

    // 2. Fail second puzzle on first attempt -> Phase 1 hint
    state = processAttempt(state, false, "d2");
    expect(state.logs).toEqual([
      { puzzleId: "p1", correct: true },
      { puzzleId: "p2", correct: false },
    ]);
    expect(state.retestQueue).toEqual([
      { id: "p2", rating: 1200, themes: ["pin"] },
    ]);
    expect(state.hintActive).toBe(true);
    expect(state.highlightedSquares).toEqual(["d2"]);

    // Try again and solve it (on second attempt)
    state = processAttempt(state, true, "d2");
    // No new log should be written (outcome logged on first attempt only)
    expect(state.logs.length).toBe(2);

    // Go to next -> Should transition to Phase 2: Delay
    state = processNext(state);
    expect(state.phase).toBe("delay");
    expect(state.delayRemaining).toBe(600);

    // 3. Complete delay and transition to Phase 3: Retest
    state.phase = "retest";
    state.currentIdx = 0;

    // Retest puzzle 2
    state = processAttempt(state, true, "d2");
    state = processNext(state);

    // Session should be complete
    expect(state.phase).toBe("complete");
  });
});
