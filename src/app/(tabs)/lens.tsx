import { Redirect } from "expo-router";

/**
 * Never reached in practice: the tab listener in `(tabs)/_layout.tsx`
 * intercepts the press and pushes `/lens-capture` full-screen instead, so the
 * camera is not letterboxed by the tab bar.
 *
 * The file exists because the navigator declares five tabs and the router
 * throws without it. It redirects rather than renders, so a deep link or a
 * restored navigation state still lands on the camera.
 */
export default function Lens() {
  return <Redirect href="/lens-capture" />;
}
