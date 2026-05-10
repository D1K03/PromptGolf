"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Player, RoomState } from "@/lib/types";
import { Button } from "@/components/jklm/button";
import { avatarUrl } from "@/lib/avatar";
import { usePhaseCountdown } from "./use-phase-countdown";
import { IntroFrame } from "./intro-frame";

interface GameIntroViewProps {
  roomState: RoomState;
  userId: string;
  onLeave: () => void;
}

const TOTAL_INTRO_SECONDS = 6;

export function GameIntroView({ roomState, onLeave }: GameIntroViewProps) {
  const secondsLeft = usePhaseCountdown(roomState.phaseEndsAt);
  const elapsed = TOTAL_INTRO_SECONDS - secondsLeft;
  // 2 slides over the 6s window: welcome (0–3s), countdown (3–6s).
  const slide = elapsed < 3 ? 0 : 1;

  const reduce = useReducedMotion();
  const { players } = roomState;

  const prompters = useMemo<Player[]>(
    () => players.filter((p) => p.role === "prompter"),
    [players]
  );

  const countdownNumber = Math.max(1, Math.ceil(secondsLeft));

  return (
    <>
      <div className="absolute top-4 left-4 z-10">
        <Button variant="neutral" size="sm" onClick={onLeave}>
          ← Leave
        </Button>
      </div>

      <IntroFrame
        slide={slide}
        totalSlides={2}
        backdrop="bg-cream"
        decorations={["⛳️", "🏌️", "⛳️", "🏌️", "🟢"]}
        accent="bg-golf"
      >
        {slide === 0 ? (
          <div className="py-6">
            <motion.div
              initial={reduce ? false : { scale: 0.5, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="mb-3 text-7xl"
              aria-hidden="true"
            >
              ⛳️
            </motion.div>

            <motion.h1
              initial={reduce ? false : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 18,
                delay: 0.1,
              }}
              className="font-heading text-5xl font-bold uppercase tracking-tight sm:text-7xl"
            >
              Prompt Golf
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mt-3 font-heading text-base text-ink/60"
            >
              shortest prompt wins · highest votes wins
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    delayChildren: 0.6,
                    staggerChildren: 0.08,
                  },
                },
              }}
              className="mt-7 flex flex-wrap items-end justify-center gap-4"
            >
              {prompters.map((p) => (
                <motion.div
                  key={p.userId}
                  variants={{
                    hidden: reduce
                      ? { opacity: 1 }
                      : { opacity: 0, y: 24, scale: 0.7 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "spring", stiffness: 320, damping: 18 },
                    },
                  }}
                  className="flex flex-col items-center"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-ink bg-white shadow-chunky-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl(p.avatarSeed || p.userId)}
                      alt={`${p.name} avatar`}
                      className="h-full w-full"
                    />
                  </div>
                  <span className="mt-2 max-w-[6rem] truncate font-heading text-xs font-bold uppercase tracking-wide">
                    {p.name}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="py-8">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="font-heading text-sm font-semibold uppercase tracking-wide text-ink/60"
            >
              round 1 starts in
            </motion.p>

            <motion.div
              key={countdownNumber}
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 16 }}
              className={`mt-3 font-heading text-9xl font-bold tabular-nums ${
                countdownNumber === 1 ? "text-pink" : "text-ink"
              }`}
              aria-live="polite"
            >
              {countdownNumber}
            </motion.div>

            <div
              className="mx-auto mt-8 h-3 max-w-md overflow-hidden rounded-full border-[3px] border-ink bg-cream"
              aria-hidden="true"
            >
              <motion.div
                initial={false}
                animate={{
                  width: `${((TOTAL_INTRO_SECONDS - secondsLeft) / TOTAL_INTRO_SECONDS) * 100}%`,
                }}
                transition={{ ease: "linear", duration: 0.25 }}
                className="h-full bg-golf"
              />
            </div>
          </div>
        )}
      </IntroFrame>
    </>
  );
}
