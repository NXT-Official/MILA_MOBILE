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

  /**
   * Writes an image and hands it to the same flow — the mobile answer to the
   * web's "Download style sheet" link, where the browser's download is the
   * share sheet's "Save to Photos" / "Save to Files".
   *
   * `dataUri` is the pipeline's own `data:image/…;base64,…` string, decoded
   * with the same `utils/data-uri` helper the storage upload uses — one
   * decoder, one set of failure modes.
   */
  saveAndShareImage(opts: { filename: string; dataUri: string }): Promise<"shared" | "cancelled">;

  /**
   * Downloads an image that already lives in Mila storage and hands it to the
   * same flow — History's saved look, whose `image_url` is a signed URL rather
   * than the pipeline's `data:` URI. Re-encoding it into a data URI first would
   * hold the whole JPEG in JS memory for no reason, so the file is downloaded
   * straight to a local one and shared from there.
   */
  saveAndShareRemoteImage(opts: {
    filename: string;
    url: string;
  }): Promise<"shared" | "cancelled">;
}
