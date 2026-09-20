import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { FilesService } from "./types";

/**
 * `SharingOptions.UTI` wants a Uniform Type Identifier, not a MIME type — the
 * two vocabularies don't overlap. This is the one mapping the app currently
 * needs (the privacy screen's JSON export); `public.data` is the generic
 * fallback UTI and is always valid, so an unrecognised MIME type degrades to
 * "some data" rather than throwing.
 */
const MIME_TO_UTI: Record<string, string> = { "application/json": "public.json" };

export const files: FilesService = {
  async saveAndShare({ filename, mimeType, contents }) {
    if (!(await Sharing.isAvailableAsync())) return "cancelled";

    // The document directory, not the cache: iOS's share sheet can be
    // dismissed and re-presented (AirDrop, "Save to Files", and a Mail
    // compose sheet can all reopen it), and a cached file is fair game for
    // eviction between the two. The document directory holds until this
    // function removes it below.
    const file = new File(Paths.document, filename);
    file.create({ overwrite: true });
    file.write(contents);

    // `shareAsync`'s promise resolves from `UIActivityViewController`'s
    // `completionWithItemsHandler`, which iOS fires exactly once, on *every*
    // dismissal path — a completed share and a cancelled one both resolve the
    // same way, with no field distinguishing them. So, like the Android
    // adapter, this always answers "shared": there is no completion signal to
    // surface, and reporting `"cancelled"` here would be a guess, not an
    // observation.
    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI: MIME_TO_UTI[mimeType] ?? "public.data",
    });

    // Unlike Android, the promise above only resolves once the activity
    // controller has actually finished — by then any destination (AirDrop,
    // Mail, Save to Files) has already read or copied what it needed, so the
    // temp file can be removed immediately rather than left for the OS to
    // reclaim under storage pressure.
    file.delete();

    return "shared";
  },
};
