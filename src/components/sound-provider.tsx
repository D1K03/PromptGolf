"use client";

import { createContext, useCallback, useContext } from "react";

interface SoundContextValue {
  playBubble: () => void;
}

const SoundContext = createContext<SoundContextValue>({
  playBubble: () => {},
});

const BUBBLE_SRC = "/audio/mixkit-quick-win-video-game-notification-269.wav";

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const playBubble = useCallback(() => {
    const audio = new Audio(BUBBLE_SRC);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => audio.remove());
  }, []);

  return (
    <SoundContext.Provider value={{ playBubble }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundEffect(): SoundContextValue {
  return useContext(SoundContext);
}
