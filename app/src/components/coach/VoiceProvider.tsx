"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Arthur's voice for the whole app. Lines play one at a time; a new topic can
 * interrupt the current one. Audio comes from /api/tts (synthesized once,
 * cached server-side). Browsers block sound until the first click on the page,
 * so a line requested before that waits and plays on the first click.
 */

type SpeakOpts = { interrupt?: boolean };
type Ctx = {
  speak: (text: string, opts?: SpeakOpts) => void;
  stop: () => void;
  speaking: boolean;
  current: string | null; // text being spoken
  muted: boolean;
  setMuted: (m: boolean) => void;
  waitingForClick: boolean;
};

const VoiceContext = createContext<Ctx | null>(null);
const MUTE_KEY = "nimzo.arthur.muted";
const urls = new Map<string, Promise<string>>();

function audioUrl(text: string): Promise<string> {
  let p = urls.get(text);
  if (!p) {
    p = fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).then(async (res) => {
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Voice unavailable");
      return URL.createObjectURL(await res.blob());
    });
    p.catch(() => urls.delete(text));
    urls.set(text, p);
  }
  return p;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const queue = useRef<string[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const playing = useRef(false);
  const mutedRef = useRef(false);
  const next = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    try {
      const m = localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = m;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only preference after mount
      setMutedState(m);
    } catch {
      // storage unavailable: default to sound on
    }
  }, []);

  const playNext = useCallback(async () => {
    if (playing.current || mutedRef.current) return;
    const text = queue.current[0];
    if (!text) return;
    playing.current = true;
    try {
      const url = await audioUrl(text);
      if (queue.current[0] !== text || mutedRef.current) {
        playing.current = false;
        void next.current();
        return;
      }
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => {
        queue.current.shift();
        playing.current = false;
        setSpeaking(false);
        setCurrent(null);
        void next.current();
      };
      try {
        await a.play();
        setWaitingForClick(false);
        setSpeaking(true);
        setCurrent(text);
      } catch (e) {
        playing.current = false;
        if ((e as DOMException).name === "NotAllowedError") {
          // Autoplay blocked until the user interacts; resume on the first click or key press.
          setWaitingForClick(true);
          const resume = () => {
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
            setWaitingForClick(false);
            void next.current();
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
        } else {
          queue.current.shift();
          void next.current();
        }
      }
    } catch (e) {
      console.warn("[arthur] voice unavailable:", (e as Error).message);
      queue.current.shift();
      playing.current = false;
      void next.current();
    }
  }, []);
  useEffect(() => {
    next.current = playNext;
  }, [playNext]);

  const stop = useCallback(() => {
    queue.current = [];
    audio.current?.pause();
    audio.current = null;
    playing.current = false;
    setSpeaking(false);
    setCurrent(null);
  }, []);

  const speak = useCallback(
    (text: string, opts?: SpeakOpts) => {
      const t = text.trim();
      if (!t) return;
      if (opts?.interrupt) stop();
      if (queue.current.includes(t)) return;
      queue.current.push(t);
      void playNext();
    },
    [playNext, stop],
  );

  const setMuted = useCallback(
    (m: boolean) => {
      mutedRef.current = m;
      setMutedState(m);
      try {
        localStorage.setItem(MUTE_KEY, m ? "1" : "0");
      } catch {
        // ignore
      }
      if (m) stop();
    },
    [stop],
  );

  const value = useMemo(() => ({ speak, stop, speaking, current, muted, setMuted, waitingForClick }), [speak, stop, speaking, current, muted, setMuted, waitingForClick]);
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): Ctx {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice outside VoiceProvider");
  return ctx;
}

/** Speaks `text` once per browser (keyed by `onceKey`), e.g. a new coach's note. */
export function useSpeakOnce(onceKey: string | null, text: string | null) {
  const { speak } = useVoice();
  useEffect(() => {
    if (!onceKey || !text) return;
    const key = `nimzo.arthur.said.${onceKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // without storage, speak it every visit
    }
    speak(text);
  }, [onceKey, text, speak]);
}

/** Small mute switch for the nav. */
export function VoiceToggle() {
  const { muted, setMuted, speaking, waitingForClick } = useVoice();
  return (
    <span className="inline-flex items-center gap-2">
      {waitingForClick && !muted && <span className="text-xs text-muted">Click anywhere to hear Arthur</span>}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
        aria-label={muted ? "Turn Arthur's voice on" : "Mute Arthur"}
        title={muted ? "Arthur is muted" : "Arthur's voice is on"}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-line ${speaking ? "bg-chip text-walnut" : "bg-card text-body2"} hover:bg-chip`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
          {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
        </svg>
      </button>
    </span>
  );
}
