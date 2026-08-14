import { Icon } from "./Icon";

/**
 * Marks an author with an in-force subscription.
 *
 * Gold, and one of the few places it appears — a single small glyph is well
 * inside the ~10% budget, and it carries one job in the card. It is never the
 * *only* signal of anything: it decorates a name that is already there, and it
 * carries its own label for assistive tech rather than relying on the hue.
 */
export function VerifiedBadge() {
  return <Icon name="verified" size="xs" color="accent" label="Verified member" />;
}
