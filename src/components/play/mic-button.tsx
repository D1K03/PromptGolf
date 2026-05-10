"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  PUSH_TO_TALK_MAX_MS,
  usePushToTalk,
} from "./use-push-to-talk";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Push-to-talk mic button. Hold to record (or click to start, click to stop).
// Streams to /api/v1/transcribe via the usePushToTalk hook and pushes the
// transcript text to onTranscript.
export function MicButton({ onTranscript, disabled = false }: MicButtonProps) {
  const reduce = useReducedMotion();
  const { status, elapsedMs, level, error, supported, start, stop, cancel } =
    usePushToTalk({ onResult: onTranscript });

  if (!supported) return null;

  const recording = status === "recording";
  const transcribing = status === "transcribing";
  const secondsLeft = Math.max(
    0,
    Math.ceil((PUSH_TO_TALK_MAX_MS - elapsedMs) / 1000),
  );
  const haloScale = 1 + Math.min(0.6, level * 0.8);

  const handleClick = () => {
    if (disabled || transcribing) return;
    if (recording) {
      stop();
    } else {
      void start();
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || transcribing}
          aria-pressed={recording}
          aria-label={
            recording
              ? "Stop recording"
              : transcribing
              ? "Transcribing"
              : "Record voice prompt"
          }
          className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-ink shadow-chunky-sm transition-colors press disabled:cursor-not-allowed disabled:opacity-60 ${
            recording
              ? "bg-pink"
              : transcribing
              ? "bg-sky"
              : "bg-white hover:bg-cream"
          }`}
        >
          {/* Pulsing halo while recording, scaled by mic level */}
          {recording && !reduce && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-pink"
              animate={{ scale: haloScale, opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span aria-hidden="true">
            {transcribing ? (
              <Spinner />
            ) : recording ? (
              <StopIcon />
            ) : (
              <MicIcon />
            )}
          </span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 font-heading text-xs">
          {recording ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-pink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink"
                />
                Recording · {secondsLeft}s
              </span>
              <button
                type="button"
                onClick={cancel}
                className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide press"
              >
                Cancel
              </button>
            </>
          ) : transcribing ? (
            <span className="rounded-full border-2 border-ink bg-sky px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Transcribing…
            </span>
          ) : (
            <span className="truncate text-ink/60">
              tap mic to speak your prompt
            </span>
          )}
        </div>
      </div>

      {/* Mic level meter (visible while recording) */}
      {recording && (
        <div
          aria-hidden="true"
          className="h-1.5 overflow-hidden rounded-full border-2 border-ink bg-cream"
        >
          <motion.div
            className="h-full bg-pink"
            animate={{ width: `${Math.round(level * 100)}%` }}
            transition={{ duration: 0.08, ease: "linear" }}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border-[3px] border-ink bg-pink px-3 py-1.5 text-center font-heading text-[11px] font-semibold"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className="h-5 w-5 animate-spin"
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1" />
      <path d="m16.3 16.3 2.1 2.1" />
      <path d="m5.6 18.4 2.1-2.1" />
      <path d="m16.3 7.7 2.1-2.1" />
    </svg>
  );
}
