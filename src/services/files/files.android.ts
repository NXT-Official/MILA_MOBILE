import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { dataUriMimeType, dataUriToBytes } from "@/utils/data-uri";

import type { FilesService } from "./types";

export const files: FilesService = {
  async saveAndShare({ filename, mimeType, contents }) {
    if (!(await Sharing.isAvailableAsync())) return "cancelled";

    // The cache directory, never external storage. `WRITE_EXTERNAL_STORAGE` is
    // a scoped-storage-era grant over the member's whole device and a share
    // intent needs none of it: the file is handed over as a content:// URI that
    // the receiving app may read exactly once.
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(contents);

    // ponytail: Android's share intent reports no completion, so a dismissed
    // sheet is indistinguishable from a saved file and this always resolves
    // "shared". If a caller ever needs the real answer, it has to come from the
    // destination, not from here — iOS reports it natively.
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });

    // The file is deliberately left in the cache: the receiving app may still
    // be reading it when this resolves, and Android reclaims the directory
    // under storage pressure anyway.
    return "shared";
  },

  async saveAndShareImage({ filename, dataUri }) {
    if (!(await Sharing.isAvailableAsync())) return "cancelled";

    const mimeType = dataUriMimeType(dataUri) ?? "image/jpeg";

    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(dataUriToBytes(dataUri));

    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });

    return "shared";
  },

  async saveAndShareRemoteImage({ filename, url }) {
    if (!(await Sharing.isAvailableAsync())) return "cancelled";

    // `idempotent` because sharing one look twice lands on a cache file the
    // first share already wrote; without it the download rejects with
    // `DestinationAlreadyExists` instead of overwriting it.
    const file = await File.downloadFileAsync(url, new File(Paths.cache, filename), {
      idempotent: true,
    });

    await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", dialogTitle: filename });

    // Left in the cache, exactly like the other two paths: the receiving app
    // may still be reading it when this resolves.
    return "shared";
  },
};
