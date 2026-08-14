/**
 * The files contract (§12). Scoped storage and the Storage Access Framework on
 * Android, the document directory and the share sheet on iOS — one API over
 * both, so the privacy screen's data export has no platform code in it.
 */
export interface FilesService {
  /**
   * Writes a file and hands it to the OS share/save flow.
   *
   * `contents` is UTF-8 text; the export is JSON, and a binary path would need
   * a different signature rather than a flag on this one.
   */
  saveAndShare(opts: {
    filename: string;
    mimeType: string;
    contents: string;
  }): Promise<"shared" | "cancelled">;
}
