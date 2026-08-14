import type { FilesService } from "./types";

/**
 * iOS stub, written alongside the Android implementation so the compiler
 * enforces parity (§12).
 *
 * What iOS will need: write into `Paths.document` rather than `Paths.cache` —
 * the share sheet may be dismissed and re-presented, and a cached file can be
 * evicted between the two — then present it with `Sharing.shareAsync`. Unlike
 * Android, iOS reports completion, so `"cancelled"` there is a real answer
 * rather than an assumption.
 */
export const files: FilesService = {
  async saveAndShare() {
    throw new Error("NOT_IMPLEMENTED");
  },
};
