import {
  addSpeechRecognitionListener,
  ExpoSpeechRecognitionModule,
} from "@jamsch/expo-speech-recognition";

/**
 * Dictation — the only thing in Mila that opens a microphone.
 *
 * A single file rather than a `services/speech/` adapter folder: the module
 * already resolves Android's `SpeechRecognizer` and iOS's `SFSpeechRecognizer`
 * behind one API, so there is no native behaviour left for us to branch on, and
 * §12 wants an adapter only where there genuinely is one. `location.ts` and
 * `captcha.ts` sit here for the same reason.
 *
 * The library's own `useSpeechRecognitionEvent` is deliberately not re-exported.
 * Everything that touches the native module goes through this file so `hooks/`
 * and `features/` never import it — §5, and the reason a microphone cannot
 * quietly acquire a second caller.
 *
 * **Nothing here records, stores, or uploads audio.** The recogniser returns
 * text and the text goes into the composer, where she can edit or delete it
 * before anything is sent. No audio file is ever created, so there is none to
 * leak into a log or a crash report (§7).
 */

export type PermissionStatus = "granted" | "denied" | "blocked";

/**
 * Three outcomes, matching `services/camera`. Android separates "denied once"
 * from "don't ask again"; the second must deep-link to settings because a
 * second prompt never appears. iOS resolves a denial straight to `blocked`.
 */
function toStatus(result: { granted: boolean; canAskAgain: boolean }): PermissionStatus {
  if (result.granted) return "granted";
  return result.canAskAgain ? "denied" : "blocked";
}

export const speech = {
  /** Reads the current status. **Never prompts** — safe to call on mount. */
  async getPermission(): Promise<PermissionStatus> {
    return toStatus(await ExpoSpeechRecognitionModule.getPermissionsAsync());
  },

  /** Prompts. Called from the mic button, never at launch (§10). */
  async requestPermission(): Promise<PermissionStatus> {
    return toStatus(await ExpoSpeechRecognitionModule.requestPermissionsAsync());
  },

  /**
   * `interimResults` so the words appear as she speaks — dictation that shows
   * nothing until she stops reads as a hang. `continuous` so a pause to think
   * does not end the session; she ends it with the button.
   */
  start(): void {
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: true,
    });
  },

  /** Ends the session and asks for one last transcript. */
  stop(): void {
    ExpoSpeechRecognitionModule.stop();
  },

  /** Drops the session without a final result — for unmount and for teardown. */
  abort(): void {
    ExpoSpeechRecognitionModule.abort();
  },

  /** Whether this device has a recogniser at all. Some Android builds ship none. */
  available(): boolean {
    return ExpoSpeechRecognitionModule.getSpeechRecognitionServices().length > 0;
  },

  onResult(handler: (transcript: string, isFinal: boolean) => void) {
    return addSpeechRecognitionListener("result", (event) => {
      const transcript = event.results[0]?.transcript ?? "";
      handler(transcript, event.isFinal);
    });
  },

  onEnd(handler: () => void) {
    return addSpeechRecognitionListener("end", handler);
  },

  onError(handler: (code: string) => void) {
    return addSpeechRecognitionListener("error", (event) => handler(event.error));
  },
};
