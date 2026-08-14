/** Copied from the web's `src/lib/utils.ts`, split per function per Appendix A. */
export function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    // An unknown or malformed currency code throws rather than degrading, and a
    // catalogue row is not worth losing over one.
    return `${currency} ${price}`;
  }
}
