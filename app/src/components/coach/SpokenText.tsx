"use client";

import { CoachAvatar } from "./CoachAvatar";
import { useSpeakOnce, useVoice } from "./VoiceProvider";

/** Arthur's face next to a line he reads aloud once (the first time it appears). */
export function ArthurSays({ text, onceKey, size = 48 }: { text: string | null; onceKey: string | null; size?: number }) {
  const { current, speaking } = useVoice();
  useSpeakOnce(onceKey, text);
  return <CoachAvatar size={size} speaking={speaking && !!text && current === text} />;
}
