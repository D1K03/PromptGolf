"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pg_music";
const SRC = "/audio/viacheslavstarostin-game-gaming-video-game-music-471936.mp3";

export function BackgroundMusic() {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setOn(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!on) {
      ref.current?.pause();
      return;
    }
    if (!ref.current) {
      const el = new Audio(SRC);
      el.loop = true;
      el.volume = 0.15;
      el.preload = "auto";
      ref.current = el;
    }
    ref.current.play().catch(() => {
      // Browser may block autoplay — user will need to interact first.
      // The toggle is already a click so it should work.
    });
  }, [on]);

  const toggle = useCallback(() => {
    setOn((v) => {
      localStorage.setItem(STORAGE_KEY, String(!v));
      return !v;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Mute background music" : "Play background music"}
      className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink bg-cream text-3xl shadow-chunky-sm transition hover:scale-110 active:scale-95"
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
