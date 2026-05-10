"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio, ApiError } from "@/lib/api";
import { tryCatch } from "@/lib/result";

// Hard cap on capture length. Server enforces ~30s via 2MB cap; we stop
// recording client-side at 25s so the encode + upload stays under that.
const MAX_RECORD_MS = 25_000;

type Status = "idle" | "recording" | "transcribing" | "error";

interface PushToTalkState {
  status: Status;
  elapsedMs: number;
  level: number; // 0–1, smoothed mic input level
  error: string | null;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

interface PushToTalkOptions {
  onResult: (text: string) => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function usePushToTalk({
  onResult,
}: PushToTalkOptions): PushToTalkState {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (tickIdRef.current !== null) {
      cancelAnimationFrame(tickIdRef.current);
      tickIdRef.current = null;
    }
    if (stopTimeoutRef.current !== null) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setLevel(0);
    setElapsedMs(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("microphone not supported in this browser");
      setStatus("error");
      return;
    }
    if (status === "recording" || status === "transcribing") return;

    setError(null);
    cancelledRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "mic permission denied"
          : "could not access microphone";
      setError(msg);
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError("could not start recorder");
      setStatus("error");
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      cleanup();

      if (cancelledRef.current) {
        setStatus("idle");
        return;
      }
      if (blob.size < 1024) {
        // <1KB → likely empty / cancelled before audio captured
        setStatus("idle");
        return;
      }

      setStatus("transcribing");
      const [err, data] = await tryCatch(transcribeAudio(blob));
      if (err) {
        setError(
          err instanceof ApiError ? err.message : "transcription failed",
        );
        setStatus("error");
        return;
      }
      const text = data.text.trim();
      if (text.length > 0) onResult(text);
      setStatus("idle");
    };

    // Mic level analyser — drives the visual pulse on the button.
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch {
      // Visualiser is decorative — fall through.
    }

    startedAtRef.current = performance.now();
    const buffer = analyserRef.current
      ? new Uint8Array(analyserRef.current.fftSize)
      : null;

    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current;
      setElapsedMs(elapsed);

      if (analyserRef.current && buffer) {
        analyserRef.current.getByteTimeDomainData(buffer);
        // RMS deviation from 128 (silence midpoint) → 0–1 level.
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buffer.length);
        setLevel((prev) => prev * 0.6 + Math.min(1, rms * 3) * 0.4);
      }

      if (elapsed >= MAX_RECORD_MS) return; // stop scheduled below
      tickIdRef.current = requestAnimationFrame(tick);
    };

    recorder.start();
    setStatus("recording");
    tickIdRef.current = requestAnimationFrame(tick);

    stopTimeoutRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, MAX_RECORD_MS);
  }, [cleanup, onResult, status, supported]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      cancelledRef.current = false;
      recorderRef.current.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      cancelledRef.current = true;
      recorderRef.current.stop();
    }
    setStatus("idle");
    setError(null);
  }, []);

  return {
    status,
    elapsedMs,
    level,
    error,
    supported,
    start,
    stop,
    cancel,
  };
}

export const PUSH_TO_TALK_MAX_MS = MAX_RECORD_MS;
