"use client";

import { useMemo } from "react";
import type { RoomState } from "@/lib/types";
import { Button } from "@/components/jklm/button";
import { Card } from "@/components/jklm/card";
import { avatarUrl } from "@/lib/avatar";
import { usePhaseCountdown } from "./use-phase-countdown";

interface TiebreakerIntroViewProps {
  roomState: RoomState;
  userId: string;
  onLeave: () => void;
}

const TOTAL_INTRO_SECONDS = 6;

export function TiebreakerIntroView({
  roomState,
  userId,
  onLeave,
}: TiebreakerIntroViewProps) {
  const secondsLeft = usePhaseCountdown(roomState.phaseEndsAt);
  const elapsed = TOTAL_INTRO_SECONDS - secondsLeft;
  // 3 slides spanning the 6s window.
  const slide = elapsed < 2 ? 0 : elapsed < 4 ? 1 : 2;

  const tiedIds = roomState.tiebreakerPlayers ?? [];
  const tiedPlayers = useMemo(
    () =>
      tiedIds
        .map((uid) => roomState.players.find((p) => p.userId === uid))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [tiedIds, roomState.players]
  );

  const isContestant = tiedIds.includes(userId);

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
              <div className="mb-4 text-7xl">⚔️</div>
              <h1 className="font-heading text-5xl font-bold uppercase tracking-tight sm:text-7xl">
                Tiebreaker!
              </h1>
              <p className="mt-3 font-heading text-base text-ink/60">
                two or more players tied — sudden death round
              </p>
            </div>
          )}

          {slide === 1 && (
            <div className="py-6">
              <p className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-ink/60">
                contestants
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {tiedPlayers.map((p, i) => (
                  <div key={p.userId} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-20 w-20 overflow-hidden rounded-full border-[3px] border-ink bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarUrl(p.avatarSeed || p.userId)}
                          alt={`${p.name} avatar`}
                          className="h-full w-full"
                        />
                      </div>
                      <span className="mt-2 font-heading text-base font-bold uppercase tracking-wide">
                        {p.name}
                      </span>
                      <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-ink/50">
                        {(roomState.scores[p.userId] ?? 0)} pts
                      </span>
                    </div>
                    {i < tiedPlayers.length - 1 && (
                      <span className="font-heading text-3xl font-bold text-ink/40">
                        VS
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {isContestant && (
                <p className="mt-5 rounded-full border-[3px] border-ink bg-pink px-3 py-1 inline-block font-heading text-xs font-bold uppercase tracking-wide">
                  You&apos;re in
                </p>
              )}
            </div>
          )}

          {slide === 2 && (
            <div className="py-10">
              <p className="font-heading text-sm font-semibold uppercase tracking-wide text-ink/60">
                round starts in
              </p>
              <div className="mt-3 font-heading text-9xl font-bold tabular-nums">
                {countdownNumber}
              </div>
            </div>
          )}

          {/* Slide indicator dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
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
