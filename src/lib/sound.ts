"use client";

import { useEffect, useState } from "react";

// Sound manager for authentic chess sounds.
// Sounds play on move, capture, and check.
// We never play sounds for correct moves, completed blocks, or finished sessions.
// Sound rewards violate Decision 16.

const STORAGE_KEY = "mainline_sound_enabled";

export type SoundKind = "move" | "capture" | "check";

const SOUND_PATHS: Record<SoundKind, string> = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  check: "/sounds/check.mp3",
};

// Client-side cached audio elements. Lazy-loaded on first play.
const audioCache = new Map<SoundKind, HTMLAudioElement>();

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent("mainline:sound-toggle", { detail: enabled }),
  );
}

export function playChessSound(kind: SoundKind): void {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;

  try {
    let audio = audioCache.get(kind);
    if (!audio) {
      audio = new Audio(SOUND_PATHS[kind]);
      audioCache.set(kind, audio);
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Safe no-op in headless tests or browsers before user gesture.
      });
    }
  } catch {
    // Safe no-op when audio subsystem is unavailable.
  }
}

export function playMoveSound(): void {
  playChessSound("move");
}

export function playCaptureSound(): void {
  playChessSound("capture");
}

export function playCheckSound(): void {
  playChessSound("check");
}

export function useSoundEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabledState] = useState<boolean>(true);

  useEffect(() => {
    setEnabledState(isSoundEnabled());

    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setEnabledState(customEvent.detail);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setEnabledState(e.newValue !== "false");
      }
    };

    window.addEventListener("mainline:sound-toggle", handleToggle);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("mainline:sound-toggle", handleToggle);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const toggle = (next: boolean) => {
    setSoundEnabled(next);
    setEnabledState(next);
  };

  return [enabled, toggle];
}
