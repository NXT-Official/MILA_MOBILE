/**
 * The onboarding name for the shared single-select row.
 *
 * Phase 03 needed the same row inside the vibe and hub sheets, and a feature
 * may not import another feature's internals — so the implementation moved to
 * `components/ui/SelectRow`. This alias keeps the onboarding steps reading in
 * their own vocabulary without a second copy of the component drifting from it.
 */
export { SelectRow as OptionTile } from "@/components/ui/SelectRow";
