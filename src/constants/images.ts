import logo from "@/assets/logo.png";

/**
 * Every bundled image is referenced here, never by an ad-hoc relative path in a
 * screen (AGENTS.md §13). One place to see what ships, one place to change a
 * path, and no duplicate `require` of the same file.
 */
export const images = {
  /** The Mila mark — brand artwork, not an icon. 200×200, transparent ground. */
  logo,
} as const;

export type ImageName = keyof typeof images;
