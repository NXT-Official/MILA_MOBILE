/**
 * The two pure decisions dictation makes, kept out of the hook so they can be
 * tested without a microphone. `lib/` has no platform dependency by rule (§5),
 * and `services/speech.ts` is about as platform as this repo gets.
 */

/**
 * Plain language, no error codes (§10). Every entry names something she can do
 * next, and the two she cannot fix say so rather than blaming her.
 */
const ERROR_COPY: Record<string, string> = {
  "not-allowed": "Mila needs microphone access to take dictation. You can turn it on in Settings.",
  "service-not-allowed": "Dictation is not available on this device.",
  "language-not-supported": "Dictation is not available in this language yet.",
  network: "Dictation needs a connection.",
  "no-speech": "Mila didn't catch that. Try again.",
  busy: "Dictation is busy. Try again in a moment.",
};

const GENERIC_ERROR = "Dictation stopped unexpectedly. Try again, or type instead.";

/** An unmapped code degrades to the generic line — never to a raw code on screen. */
export function dictationErrorCopy(code: string): string {
  return ERROR_COPY[code] ?? GENERIC_ERROR;
}

/**
 * The composer's next value while she speaks.
 *
 * `base` is whatever was in the box when the mic started; `transcript` is the
 * recogniser's **whole** result so far, not a delta — it revises what it has
 * already returned ("to" becoming "two" once the sentence lands), so replacing
 * is correct and appending would leave both.
 *
 * The space only appears between two non-empty halves: dictating into an empty
 * box must not produce a leading space, and a trailing one before the first
 * word would show up in the box as a cursor that has drifted.
 */
export function composeTranscript(base: string, transcript: string): string {
  if (!base) return transcript;
  if (!transcript) return base;
  return `${base} ${transcript}`;
}
