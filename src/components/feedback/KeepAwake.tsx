import { useKeepAwake } from "expo-keep-awake";

/**
 * Holds the screen on for as long as this is mounted.
 *
 * A component rather than a conditional hook call, because that is illegal —
 * render `{generating ? <KeepAwake /> : null}` and mounting is the switch.
 *
 * Earns its place during generation: the composition budgets 60s and the image
 * 90s, which is comfortably past most Android lock timeouts. A screen that
 * sleeps mid-call leaves a member holding a dark phone after she has already
 * been charged.
 */
export function KeepAwake() {
  useKeepAwake();
  return null;
}
