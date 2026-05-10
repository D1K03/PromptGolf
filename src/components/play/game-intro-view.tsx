"use client";

import { useMemo } from "react";
import type { Player, RoomState } from "@/lib/types";
import { Button } from "@/components/jklm/button";
import { Card } from "@/components/jklm/card";
import { avatarUrl } from "@/lib/avatar";
import { usePhaseCountdown } from "./use-phase-countdown";

interface GameIntroViewProps {
  roomState: RoomState;
  userId: string;
  onLeave: () => void;
}

const TOTAL_INTRO_SECONDS = 6;

export function GameIntroView({ roomState, onLeave }: GameIntroViewProps) {
  const secondsLeft = usePhaseCountdown(roomState.phaseEndsAt);
  const elapsed = TOTAL_INTRO_SECONDS - secondsLeft;
  // 2 slides spanning the 6s window: welcome (0–3s), countdown (3–6s).
  const slide = elapsed < 3 ? 0 : 1;

  const { players } = roomState;

  const prompters = useMemo<Player[]>(
    () => players.filter((p) => p.role === "prompter"),
    [players]
  );

  const countdownNumber = Math.max(1, Math.ceil(secondsLeft));

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <div className="absolute top-4 left-4">
        <Button variant="neutral" size="sm" onClick={onLeave}>
          ← Leave
        </Button>
      </div>

      <div className="w-full max-w-3xl">
        <Card elevation="lg" className="overflow-hidden text-center">
          {slide === 0 && (
            <div className="animate-pulse-slow py-8">
              <div className="mb-3 text-7xl">⛳️</div>
              <h1 className="font-heading text-5xl font-bold uppercase tracking-tight sm:text-7xl">
                Prompt Golf
              </h1>
              <p className="mt-3 font-heading text-base text-ink/60">
                shortest prompt wins · highest votes wins
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {prompters.map((p) => (
                  <div key={p.userId} className="flex flex-col items-center">
                    <div className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-ink bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl(p.avatarSeed || p.userId)}
                        alt={`${p.name} avatar`}
                        className="h-full w-full"
                      />
                    </div>
                    <span className="mt-1 font-heading text-xs font-bold uppercase tracking-wide">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slide === 1 && (
            <div className="py-10">
              <p className="font-heading text-sm font-semibold uppercase tracking-wide text-ink/60">
                round 1 starts in
              </p>
              <div className="mt-3 font-heading text-9xl font-bold tabular-nums">
                {countdownNumber}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            {[0, 1].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-2 w-2 rounded-full border-2 border-ink transition-colors ${
                  i === slide ? "bg-golf" : "bg-white"
                }`}
              />
            ))}
          </div>
        </Card>
      </div>

      <style jsx>{`
        .animate-pulse-slow {
          animation: pulse-slow 1.6s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </main>
  );
}
