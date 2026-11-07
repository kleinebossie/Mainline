"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Sun, Moon, Volume2, VolumeX, Clock, Palette } from "lucide-react";
import {
  BOARD_THEMES,
  type BoardThemeId,
} from "@/components/interactive-board";
import { isSoundEnabled, setSoundEnabled, playMoveSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceContent, SurfaceHeader, SurfaceTitle, SurfaceDescription } from "@/components/ui/surface";

export function AppearanceAndBoard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>("sheet");
  const [soundOn, setSoundOn] = useState(true);
  const [showPuzzleTimer, setShowPuzzleTimer] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedBoard = window.localStorage.getItem(
      "mainline_board_theme",
    ) as BoardThemeId | null;
    if (storedBoard && storedBoard in BOARD_THEMES) {
      setBoardTheme(storedBoard);
    }
    setSoundOn(isSoundEnabled());

    const storedTimer = window.localStorage.getItem("mainline_show_puzzle_time");
    setShowPuzzleTimer(storedTimer === "true");
  }, []);

  function handleBoardThemeChange(id: BoardThemeId) {
    setBoardTheme(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mainline_board_theme", id);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "mainline_board_theme",
          newValue: id,
        }),
      );
    }
  }

  function handleSoundToggle(enabled: boolean) {
    setSoundOn(enabled);
    setSoundEnabled(enabled);
    if (enabled) {
      playMoveSound();
    }
  }

  function handleTimerToggle(enabled: boolean) {
    setShowPuzzleTimer(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "mainline_show_puzzle_time",
        enabled ? "true" : "false",
      );
    }
  }

  if (!mounted) {
    return (
      <Surface raised={false} className="p-6">
        <div className="h-48 animate-pulse rounded bg-paper-raised/60" />
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Theme selection */}
      <Surface raised={false} className="p-6">
        <SurfaceHeader className="p-0 pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-evergreen" aria-hidden="true" />
            <SurfaceTitle className="text-lg sm:text-xl">Theme</SurfaceTitle>
          </div>
          <SurfaceDescription>
            Select your preferred display theme across all pages.
          </SurfaceDescription>
        </SurfaceHeader>

        <SurfaceContent className="p-0 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "system", label: "System", icon: Monitor, desc: "Match device setting" },
              { id: "light", label: "Light", icon: Sun, desc: "Paper and ink" },
              { id: "dark", label: "Dark", icon: Moon, desc: "Slate and night" },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={`flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-all ${
                    isSelected
                      ? "border-evergreen bg-paper ring-2 ring-evergreen/20"
                      : "border-line bg-paper-raised hover:border-line-emphasis"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className={`h-5 w-5 ${isSelected ? "text-evergreen" : "text-graphite"}`} />
                    {isSelected && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-evergreen bg-evergreen/10 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-ink text-sm">{option.label}</div>
                    <div className="text-xs text-graphite font-serif">{option.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </SurfaceContent>
      </Surface>

      {/* Board themes */}
      <Surface raised={false} className="p-6">
        <SurfaceHeader className="p-0 pb-4">
          <SurfaceTitle className="text-lg sm:text-xl">Board style</SurfaceTitle>
          <SurfaceDescription>
            Choose square colors for the chessboard. Your choice saves on this device.
          </SurfaceDescription>
        </SurfaceHeader>

        <SurfaceContent className="p-0 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => {
              const item = BOARD_THEMES[id];
              const isSelected = boardTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleBoardThemeChange(id)}
                  className={`flex flex-col items-center gap-3 rounded-md border p-3 transition-all ${
                    isSelected
                      ? "border-evergreen bg-paper ring-2 ring-evergreen/20"
                      : "border-line bg-paper-raised hover:border-line-emphasis"
                  }`}
                  aria-pressed={isSelected}
                >
                  {/* Chessboard mini preview */}
                  <div className="grid grid-cols-2 h-14 w-14 rounded overflow-hidden border border-line shadow-sm">
                    <div style={{ backgroundColor: item.lightSquare }} />
                    <div style={{ backgroundColor: item.darkSquare }} />
                    <div style={{ backgroundColor: item.darkSquare }} />
                    <div style={{ backgroundColor: item.lightSquare }} />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-xs text-ink">{item.label}</div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-evergreen">Active</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </SurfaceContent>
      </Surface>

      {/* Sound controls */}
      <Surface raised={false} className="p-6">
        <SurfaceHeader className="p-0 pb-4">
          <div className="flex items-center gap-2">
            {soundOn ? (
              <Volume2 className="h-5 w-5 text-evergreen" aria-hidden="true" />
            ) : (
              <VolumeX className="h-5 w-5 text-graphite" aria-hidden="true" />
            )}
            <SurfaceTitle className="text-lg sm:text-xl">Board sounds</SurfaceTitle>
          </div>
          <SurfaceDescription>
            Play authentic sound effects on piece moves, captures, and checks. Mainline never plays reward sounds.
          </SurfaceDescription>
        </SurfaceHeader>

        <SurfaceContent className="p-0 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={soundOn ? "default" : "outline"}
              size="sm"
              onClick={() => handleSoundToggle(!soundOn)}
            >
              {soundOn ? "Sounds enabled" : "Sounds muted"}
            </Button>
            {soundOn && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => playMoveSound()}
              >
                Test sound
              </Button>
            )}
          </div>
          <span className="text-xs text-graphite font-serif">
            Muting disables sound effects without affecting other settings.
          </span>
        </SurfaceContent>
      </Surface>

      {/* Timer display */}
      <Surface raised={false} className="p-6">
        <SurfaceHeader className="p-0 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-evergreen" aria-hidden="true" />
            <SurfaceTitle className="text-lg sm:text-xl">Puzzle timer</SurfaceTitle>
          </div>
          <SurfaceDescription>
            Show the elapsed timer when solving tactics.
          </SurfaceDescription>
        </SurfaceHeader>

        <SurfaceContent className="p-0 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button
            type="button"
            variant={showPuzzleTimer ? "default" : "outline"}
            size="sm"
            onClick={() => handleTimerToggle(!showPuzzleTimer)}
          >
            {showPuzzleTimer ? "Timer visible" : "Timer hidden"}
          </Button>
          <span className="text-xs text-graphite font-serif">
            Hiding the timer reduces rush. Time spent still tracks for spaced repetition.
          </span>
        </SurfaceContent>
      </Surface>
    </div>
  );
}
