"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Arthur's voice for the whole app, using the browser's built-in speech
 * synthesis (free, runs on your computer). Lines play one at a time; a new
 * topic can interrupt the current one. Browsers may block speech until the
 * first click on the page, so a line requested before that waits for it.
 */

type SpeakOpts = { interrupt?: boolean };
type Ctx = {
  speak: (text: string, opts?: SpeakOpts) => void;
  stop: () => void;
  speaking: boolean;
  current: string | null; // the line being spoken
  muted: boolean;
  setMuted: (m: boolean) => void;
  waitingForClick: boolean;
  supported: boolean;
};

const VoiceContext = createContext<Ctx | null>(null);
const MUTE_KEY = "nimzo.arthur.muted";

/** Preferred voices for an older British club coach, best first; falls back to any English voice. */
const PREFERRED = [/arthur/i, /george/i, /daniel/i, /uk english male/i, /ryan/i, /thomas/i, /oliver/i, /alfie/i];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name) && x.lang.toLowerCase().startsWith("en"));
    if (v) return v;
  }
  return voices.find((v) => v.lang.toLowerCase() === "en-gb") ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
}

/** Chrome cuts off long utterances, so speak sentence by sentence. */
function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const [supported, setSupported] = useState(true);
  const queue = useRef<string[]>([]);
  const playing = useRef(false);
  const mutedRef = useRef(false);
  const generation = useRef(0); // bumps on stop() so stale callbacks are ignored
  const next = useRef<() => void>(() => {});

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only capabilities and preferences, read after mount */
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    try {
      const m = localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = m;
      setMutedState(m);
    } catch {
      // storage unavailable: default to sound on
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    window.speechSynthesis.getVoices(); // voices load asynchronously in some browsers
    return () => window.speechSynthesis.cancel();
  }, []);

  const playNext = useCallback(() => {
    if (playing.current || mutedRef.current || !("speechSynthesis" in window)) return;
    const text = queue.current[0];
    if (!text) return;
    playing.current = true;
    const gen = generation.current;
    const voice = pickVoice();
    const parts = sentences(text);
    let i = 0;

    const finish = () => {
      if (gen !== generation.current) return;
      queue.current.shift();
      playing.current = false;
      setSpeaking(false);
      setCurrent(null);
      next.current();
    };

    const sayPart = () => {
      if (gen !== generation.current) return;
      if (i >= parts.length) return finish();
      const u = new SpeechSynthesisUtterance(parts[i++]!);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "en-GB";
      u.rate = 0.95;
      u.pitch = 0.85;
      u.onstart = () => {
        if (gen !== generation.current) return;
        setWaitingForClick(false);
        setSpeaking(true);
        setCurrent(text);
      };
      u.onend = sayPart;
      u.onerror = (e) => {
        if (gen !== generation.current) return;
        if (e.error === "not-allowed") {
          // Speech blocked until the user interacts; resume on the first click or key press.
          playing.current = false;
          setWaitingForClick(true);
          const resume = () => {
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
            setWaitingForClick(false);
            next.current();
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
          return;
        }
        if (e.error === "interrupted" || e.error === "canceled") return;
        sayPart();
      };
      window.speechSynthesis.speak(u);
    };
    sayPart();
  }, []);
  useEffect(() => {
    next.current = playNext;
  }, [playNext]);

  const stop = useCallback(() => {
    generation.current++;
    queue.current = [];
    playing.current = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setCurrent(null);
  }, []);

  const speak = useCallback(
    (text: string, opts?: SpeakOpts) => {
      const t = text.trim();
      if (!t || !supported) return;
      if (playing.current && queue.current[0] === t) return; // already saying exactly this
      if (opts?.interrupt) stop();
      if (queue.current.includes(t)) return;
      queue.current.push(t);
      playNext();
    },
    [playNext, stop, supported],
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

  const value = useMemo(
    () => ({ speak, stop, speaking, current, muted, setMuted, waitingForClick, supported }),
    [speak, stop, speaking, current, muted, setMuted, waitingForClick, supported],
  );
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
  const { muted, setMuted, waitingForClick, supported } = useVoice();
  if (!supported) return null;
  return (
    <span className="inline-flex items-center gap-2">
      {waitingForClick && !muted && <span className="text-xs text-muted">Click anywhere to hear Arthur</span>}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
        aria-label={muted ? "Turn Arthur's voice on" : "Mute Arthur"}
        title={muted ? "Arthur is muted" : "Arthur's voice is on"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-line bg-card text-body2 hover:bg-chip"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
          {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
        </svg>
      </button>
    </span>
  );
}
