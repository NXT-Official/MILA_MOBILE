import { useEffect, useRef, useState } from "react";

import { composeTranscript, dictationErrorCopy } from "@/lib/dictation";
import { speech } from "@/services/speech";

export type Dictation = {
  /** False on a device with no recogniser — the caller hides the control. */
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
  /** Closes the microphone without a final result. Called when a message goes. */
  cancel: () => void;
};

/**
 * The mic button's state machine.
 *
 * `onTranscript` is called with the **full text so far**, interim results
 * included, so the composer fills in as she speaks. It is given the whole
 * string rather than a delta because the recogniser revises what it already
 * returned — "to" becoming "two" once the sentence lands — and appending deltas
 * would leave both.
 *
 * The transcript replaces what dictation itself has written, never what she
 * typed: `baseRef` snapshots the draft at the moment the mic starts.
 */
export function useDictation(
  draft: string,
  onTranscript: (next: string) => void,
): Dictation {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() => speech.available());

  /** What was in the box before dictation began. Dictation appends to it. */
  const baseRef = useRef("");
  useEffect(() => {
    if (!supported) return;

    const result = speech.onResult((transcript) => {
      onTranscript(composeTranscript(baseRef.current, transcript));
    });
    const ended = speech.onEnd(() => setListening(false));
    const failed = speech.onError((code) => {
      setListening(false);
      setError(dictationErrorCopy(code));
    });

    return () => {
      result.remove();
      ended.remove();
      failed.remove();
      // Leaving the screen with the microphone open is the one outcome that is
      // not recoverable from the UI, so teardown always closes it.
      speech.abort();
    };
    // Registered once. `onTranscript` is a fresh closure every render and
    // re-subscribing on it would drop events mid-sentence; it only ever writes
    // through a setState, so the stale closure is harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  function toggle() {
    if (listening) {
      speech.stop();
      setListening(false);
      return;
    }

    setError(null);
    void speech.requestPermission().then((status) => {
      if (status !== "granted") {
        setError(dictationErrorCopy("not-allowed"));
        return;
      }
      // Read straight from this render's props: `toggle` is an event handler,
      // recreated with a fresh `draft` every render, so there is no stale value
      // to guard against and no ref to write during render.
      baseRef.current = draft.trim();
      setListening(true);
      speech.start();
    });
  }

  function cancel() {
    if (!listening) return;
    speech.abort();
    setListening(false);
  }

  return { supported, listening, error, toggle, cancel };
}
