"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Attempt, RoomState } from "@/lib/types";
import { ApiError, getRoundDetails, pickAttempt } from "@/lib/api";
import { tryCatch } from "@/lib/result";
import { useSoundEffect } from "@/components/sound-provider";
import { Button } from "@/components/jklm/button";
import { Card } from "@/components/jklm/card";
import { findCategory } from "@/lib/room-constants";
import { usePhaseCountdown } from "./use-phase-countdown";

interface PickingViewProps {
  code: string;
  roomState: RoomState;
  userId: string;
  onLeave: () => void;
}

export function PickingView({
  code,
  roomState,
  userId,
  onLeave,
}: PickingViewProps) {
  const { playBubble } = useSoundEffect();
  const reduce = useReducedMotion();
  const { settings, currentRound, players, hostId, targetImageUrl } = roomState;
  const secondsLeft = usePhaseCountdown(roomState.phaseEndsAt);
  const category = findCategory(settings.category);

  const isHost = userId === hostId;
  const me = players.find((p) => p.userId === userId);
  const isSpectator = !isHost && me?.role === "spectator";

  const [myAttempts, setMyAttempts] = useState<Attempt[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pickBusy, setPickBusy] = useState<boolean>(false);

  // Initial fetch — myAttempts + current pick.
  // Retries once after 1.5s if the result is empty, as a safety net against
  // a brief Redis read-after-write inconsistency.
  useEffect(() => {
    if (currentRound < 1) return;
    let cancelled = false;
    void (async () => {
      const [err, data] = await tryCatch(getRoundDetails(code, currentRound));
      if (cancelled) return;
      if (err) {
        console.error("getRoundDetails failed:", err);
        setLoading(false);
        return;
      }
      if (data.myAttempts.length === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        const [retryErr, retryData] = await tryCatch(
          getRoundDetails(code, currentRound),
        );
        if (retryErr) {
          console.error("getRoundDetails retry failed:", retryErr);
        } else {
          setMyAttempts(retryData.myAttempts);
          setPickedId(retryData.myPick);
          setLoading(false);
          return;
        }
      }
      setMyAttempts(data.myAttempts);
      setPickedId(data.myPick);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, currentRound]);

  const handlePick = useCallback(
    async (attemptId: string) => {
      if (pickBusy) return;
      playBubble();
      const prev = pickedId;
      setPickError(null);
      setPickBusy(true);
      setPickedId(attemptId); // optimistic
      const [err] = await tryCatch(pickAttempt(code, attemptId));
      setPickBusy(false);
      if (err) {
        setPickedId(prev);
        setPickError(err instanceof ApiError ? err.message : "Pick failed");
      }
    },
    [code, pickBusy, pickedId, playBubble],
  );

  const urgent = secondsLeft <= 5 && secondsLeft > 0;
  const pickedAttempt = myAttempts.find((a) => a.id === pickedId) ?? null;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-cream px-4 pb-8 pt-5">
      {/* Warm decision-making backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(244,114,182,0.18), transparent 55%), radial-gradient(ellipse at bottom right, rgba(250,204,21,0.12), transparent 55%)",
        }}
      />

      {/* Urgency vignette on last 5s */}
      <AnimatePresence>
        {urgent && !reduce && (
          <motion.div
            key="urgency"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.55, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity }}
            style={{ boxShadow: "inset 0 0 120px 40px rgba(244,114,182,0.55)" }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        {/* Top strip */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="neutral" size="sm" onClick={onLeave}>
            ← Leave
          </Button>

          <div className="flex items-center gap-1.5 rounded-full border-[3px] border-ink bg-white px-2 py-1 shadow-chunky-sm">
            <span className="rounded-full border-2 border-ink bg-pink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide">
              ★ Pick
            </span>
            <span className="rounded-full border-2 border-ink bg-golf px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide tabular-nums">
              R{currentRound}/{settings.rounds}
            </span>
            {category && (
              <span
                className="flex items-center gap-1 rounded-full border-2 border-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: category.color }}
              >
                <span aria-hidden="true">{category.emoji}</span>
                <span className="hidden sm:inline">{category.label}</span>
              </span>
            )}
            <motion.span
              animate={
                urgent && !reduce ? { scale: [1, 1.1, 1] } : { scale: 1 }
              }
              transition={{ duration: 0.5, repeat: urgent ? Infinity : 0 }}
              className={`rounded-full border-2 border-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide tabular-nums ${
                urgent ? "bg-pink text-ink" : "bg-cream"
              }`}
              aria-live="polite"
            >
              {secondsLeft}s
            </motion.span>
          </div>
        </div>

        {/* Hero header */}
        <div className="mb-5 text-center">
          <motion.h1
            initial={reduce ? false : { y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="font-heading text-4xl font-bold uppercase tracking-tight sm:text-5xl"
          >
            Pick Your Shot
          </motion.h1>
          <p className="mt-1 font-heading text-sm text-ink/55">
            this is what the voters will see
          </p>
        </div>

        {/* Compare layout: target on left, attempts grid on right (stacks on mobile) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {/* Target reference */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="relative">
              <span className="absolute -top-3 left-4 z-10 rounded-full border-[3px] border-ink bg-sky px-3 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide shadow-chunky-sm">
                🎯 Target
              </span>
              <Card className="p-4">
                {targetImageUrl ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-cream shadow-chunky-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={targetImageUrl}
                      alt="Target image"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-2xl border-[3px] border-dashed border-ink/30 bg-cream font-heading text-xs text-ink/40">
                    target unavailable
                  </div>
                )}

                {/* Live picked preview underneath target */}
                <div className="mt-4 rounded-2xl border-[3px] border-dashed border-ink/30 bg-cream/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-ink/55">
                      Your locked pick
                    </span>
                    {pickedAttempt && (
                      <span className="rounded-full border-2 border-ink bg-golf px-2 py-0.5 font-heading text-[9px] font-bold uppercase tracking-wide tabular-nums">
                        #{myAttempts.indexOf(pickedAttempt) + 1}
                      </span>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {pickedAttempt ? (
                      <motion.div
                        key={pickedAttempt.id}
                        initial={
                          reduce ? false : { scale: 0.92, opacity: 0 }
                        }
                        animate={{ scale: 1, opacity: 1 }}
                        exit={reduce ? undefined : { scale: 0.92, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 360,
                          damping: 22,
                        }}
                        className="overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-chunky-sm"
                      >
                        <div className="aspect-square overflow-hidden bg-cream">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pickedAttempt.imageUrl}
                            alt={pickedAttempt.prompt}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p
                          className="line-clamp-2 px-2 py-1.5 font-heading text-[11px] leading-snug"
                          title={pickedAttempt.prompt}
                        >
                          {pickedAttempt.prompt}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="empty"
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        className="flex aspect-square items-center justify-center text-center font-heading text-xs text-ink/40"
                      >
                        tap a shot →
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </div>
          </div>

          {/* Attempts grid */}
          <Card className="relative">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
                Your shots
              </h2>
              <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-ink/40 tabular-nums">
                {myAttempts.length}{" "}
                {myAttempts.length === 1 ? "attempt" : "attempts"}
              </span>
            </div>

            {isSpectator ? (
              <div className="flex items-center justify-center rounded-2xl border-[3px] border-dashed border-ink/40 bg-cream p-10 text-center">
                <div>
                  <div className="text-5xl" aria-hidden="true">
                    👀
                  </div>
                  <p className="mt-2 font-heading text-sm font-bold uppercase tracking-wide text-ink/60">
                    spectating
                  </p>
                  <p className="mt-1 font-heading text-xs text-ink/40">
                    players are choosing their shots
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl border-[3px] border-ink bg-cream"
                  >
                    <motion.div
                      animate={
                        reduce ? undefined : { opacity: [0.4, 0.7, 0.4] }
                      }
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                      className="h-full w-full rounded-2xl bg-white/40"
                    />
                  </div>
                ))}
              </div>
            ) : myAttempts.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border-[3px] border-dashed border-ink/40 bg-cream p-8 text-center">
                <div>
                  <div className="text-4xl">🫥</div>
                  <p className="mt-2 font-heading text-sm font-semibold text-ink/55">
                    no attempts to pick from
                  </p>
                  <p className="mt-1 font-heading text-xs text-ink/40">
                    you didn&apos;t submit anything this round
                  </p>
                </div>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.04 } },
                }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {myAttempts.map((a, idx) => {
                  const selected = pickedId === a.id;
                  return (
                    <motion.button
                      key={a.id}
                      type="button"
                      onClick={() => handlePick(a.id)}
                      disabled={pickBusy}
                      aria-pressed={selected}
                      variants={{
                        hidden: reduce
                          ? { opacity: 1 }
                          : { opacity: 0, y: 14, scale: 0.94 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: {
                            type: "spring",
                            stiffness: 280,
                            damping: 20,
                          },
                        },
                      }}
                      whileHover={
                        reduce || selected ? undefined : { y: -3 }
                      }
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border-[3px] border-ink text-left transition-shadow disabled:cursor-not-allowed ${
                        selected
                          ? "bg-golf shadow-chunky"
                          : "bg-white shadow-chunky-sm hover:shadow-chunky"
                      }`}
                    >
                      <div
                        className={`relative aspect-square overflow-hidden border-b-[3px] border-ink ${
                          selected ? "bg-golf" : "bg-cream"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.imageUrl}
                          alt={`Attempt ${idx + 1}`}
                          className={`h-full w-full object-cover transition-transform duration-300 ${
                            !selected && !reduce
                              ? "group-hover:scale-105"
                              : ""
                          }`}
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide tabular-nums shadow-chunky-sm">
                          #{idx + 1}
                        </span>
                        <span className="absolute right-1.5 top-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide tabular-nums">
                          {a.chars}c
                        </span>

                        {/* Big picked badge overlay */}
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={
                                reduce
                                  ? false
                                  : { scale: 0.5, opacity: 0, rotate: -8 }
                              }
                              animate={{ scale: 1, opacity: 1, rotate: -6 }}
                              exit={
                                reduce ? undefined : { scale: 0.6, opacity: 0 }
                              }
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 18,
                              }}
                              className="pointer-events-none absolute inset-0 flex items-center justify-center"
                            >
                              <div className="rounded-2xl border-[4px] border-ink bg-sun px-4 py-1.5 font-heading text-base font-extrabold uppercase tracking-wide shadow-chunky">
                                ✓ Locked In
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <p
                        className={`line-clamp-2 px-2 py-1.5 font-heading text-[11px] leading-snug ${
                          selected ? "font-bold" : "text-ink/75"
                        }`}
                        title={a.prompt}
                      >
                        {a.prompt}
                      </p>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {pickError && (
              <motion.p
                role="alert"
                initial={reduce ? false : { y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-4 rounded-xl border-[3px] border-ink bg-pink px-4 py-2 text-center font-heading text-xs font-semibold"
              >
                {pickError}
              </motion.p>
            )}

            {!isSpectator && myAttempts.length > 0 && !pickedId && (
              <p className="mt-3 text-center font-heading text-[11px] text-ink/45">
                no pick? your last submission is used automatically
              </p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
