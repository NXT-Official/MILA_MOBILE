import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { Screen } from "@/components/layout/Screen";
import { CameraPermissionPrompt } from "@/components/media/CameraPermissionPrompt";
import { ShutterControls } from "@/components/media/ShutterControls";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  MAKEUP_CATEGORIES,
  MAKEUP_LOOKS,
  NAMED_PALETTE,
  type MakeupLook,
  type NamedSwatch,
} from "@/constants/style-profile";
import { useHaptics } from "@/hooks/use-haptics";
import { useProfile } from "@/hooks/use-profile";
import { normalizeStoredProfile } from "@/lib/style-profile/studio-dossier";
import {
  CameraPreview,
  camera,
  type CameraHandle,
  type CapturedPhoto,
  type PermissionStatus,
} from "@/services/camera";
import { radii } from "@/theme/tokens";
import { cn } from "@/utils/cn";

import { resolveSeasonFamily } from "./season";

type Mode = "makeup" | "colours";
type Verdict = "Ideal" | "Harmonizing" | "Accent";

const VERDICT_CAPTION: Record<Verdict, string> = {
  Ideal:
    "Sits closest to your own colouring — wear it near the face without a second thought.",
  Harmonizing:
    "Works, but reads quieter. Best as the second or third colour in a look.",
  Accent: "One deliberate note — a scarf, a lip, a shoe. Not the whole outfit.",
};

/**
 * Try looks on yourself — the web's Studio workspace (`/style-profile`), which
 * on mobile is a stack screen off the dossier rather than a second tab.
 *
 * The photo never leaves the device. It is a local capture URI held in state
 * and dropped when the screen unmounts: nothing is uploaded, which is why this
 * is a *preview* and not a render, and why it costs no credit and calls no
 * server. §7's "upload first, then reference" does not apply because nothing
 * here is ever analysed.
 */
export function TryOnScreen() {
  const { data: profile, isPending, isError, refetch } = useProfile();

  /** Null while the first, non-prompting permission read is in flight. */
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  const [mode, setMode] = useState<Mode>("makeup");
  const [category, setCategory] = useState<MakeupLook["category"]>("Lips");
  const [look, setLook] = useState<MakeupLook | null>(null);
  const [colour, setColour] = useState<{
    swatch: NamedSwatch;
    verdict: Verdict;
  } | null>(null);

  const handle = useRef<CameraHandle>(null);
  const haptics = useHaptics();

  // Read on mount, never prompt on mount — the rationale screen owns the
  // prompt, so she sees why the camera is wanted before the OS asks (§10).
  useEffect(() => {
    let active = true;
    void camera
      .getPermission()
      .then((status) => active && setPermission(status))
      .catch(() => active && setPermission("blocked"));
    return () => {
      active = false;
    };
  }, []);

  async function handleAllow() {
    setRequesting(true);
    try {
      setPermission(await camera.requestPermission());
    } catch {
      setPermission("blocked");
    } finally {
      setRequesting(false);
    }
  }

  async function withCapture(take: () => Promise<CapturedPhoto | null>) {
    setCapturing(true);
    setCaptureError(null);
    try {
      const next = await take();
      // A cancelled picker is not a failure — she simply changed her mind.
      if (next) {
        setPhoto(next);
        setCameraOpen(false);
        haptics.selection();
      }
    } catch {
      setCaptureError("That photo didn't come through. Try again.");
    } finally {
      setCapturing(false);
    }
  }

  if (isPending) {
    return (
      <Frame>
        <LoadingState label="Loading your palette" lines={4} />
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Your palette didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Frame>
    );
  }

  const dossier = normalizeStoredProfile(profile?.color_profile);
  const family = resolveSeasonFamily(profile?.color_season_base, dossier);

  // Without a season there is no palette to try on, and a defaulted one would
  // be someone else's colouring previewed against her face.
  if (!family) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="studio"
            title="Your palette isn't set yet"
            description="Read your colouring first — the try-on previews the season it produces."
            actionLabel="Read my colouring"
            onAction={() => router.replace("/dossier/color")}
          />
        </View>
      </Frame>
    );
  }

  // The camera is a blocking state, not a panel: a rationale squeezed into a
  // preview tile is unreadable, and the member has one decision to make.
  if (cameraOpen && permission !== null && permission !== "granted") {
    return (
      <Frame>
        <CameraPermissionPrompt
          status={permission}
          requesting={requesting}
          onAllow={() => void handleAllow()}
          onOpenSettings={() => void camera.openSettings()}
        />
      </Frame>
    );
  }

  const palette = NAMED_PALETTE[family];
  const looks = MAKEUP_LOOKS[family].filter((l) => l.category === category);
  const overlayHex =
    mode === "makeup" ? (look?.hex ?? null) : (colour?.swatch.hex ?? null);
  const selectedName = mode === "makeup" ? look?.name : colour?.swatch.name;
  const selectedNote =
    mode === "makeup"
      ? look?.note
      : colour
        ? VERDICT_CAPTION[colour.verdict]
        : undefined;

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      <View className="gap-xl pb-2xl pt-lg">
        <View className="gap-sm">
          <Text
            accessibilityRole="header"
            className="font-display text-h1 tracking-heading text-ink"
          >
            Try looks on yourself
          </Text>
          <Text className="font-body text-base text-body">
            Take a selfie or choose a photo to preview makeup and seasonal
            colours on your own features.
          </Text>
        </View>

        {/* PREVIEW */}
        <View className="gap-md">
          <View
            // Case 1 of the StyleSheet exceptions: Tailwind ships no 3:4 aspect
            // utility and an arbitrary value is banned outside `theme/` (§9).
            style={{ aspectRatio: 3 / 4, borderRadius: radii.card }}
            className="overflow-hidden border border-border bg-surface-alt dark:border-border/12"
          >
            {cameraOpen ? (
              <CameraPreview
                facing="front"
                ref={handle}
                onReady={() => setPreviewReady(true)}
              />
            ) : photo ? (
              <>
                <Image
                  source={{ uri: photo.uri }}
                  // Case 1: expo-image takes a style object.
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel="Your photo, for previewing colours against"
                />
                {overlayHex ? (
                  <ShadeOverlay hex={overlayHex} mode={mode} />
                ) : null}
              </>
            ) : (
              <View className="flex-1 items-center justify-center gap-lg px-xl">
                <Icon name="camera" size="xl" color="muted" />
                <Text className="font-body text-sm text-body text-center">
                  See your palette on your own features. Take a selfie or choose
                  a clear photo to try makeup and seasonal colours on yourself.
                </Text>
              </View>
            )}

            {/* The season label rides on the preview, as on the web, so the
                shade she is looking at is never separated from whose palette
                it belongs to. */}
            <View className="absolute inset-x-0 top-0 flex-row justify-end p-md">
              <Text
                numberOfLines={1}
                className="font-body-semibold text-label tracking-label uppercase text-on-ink rounded-pill bg-ink/85 px-md py-xs"
              >
                {dossier?.subSeason || family}
              </Text>
            </View>
          </View>

          {captureError ? <InlineError message={captureError} /> : null}

          {cameraOpen ? (
            <>
              <ShutterControls
                busy={capturing || !previewReady}
                onCapture={() =>
                  void withCapture(
                    async () => (await handle.current?.capture()) ?? null,
                  )
                }
                onPickFromLibrary={() =>
                  void withCapture(() => camera.pickFromLibrary())
                }
              />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setCameraOpen(false);
                  setPreviewReady(false);
                }}
              />
            </>
          ) : photo ? (
            <>
              <Button
                label="Choose another photo"
                variant="secondary"
                icon="gallery"
                onPress={() => void withCapture(() => camera.pickFromLibrary())}
              />
              <Button
                label="Retake"
                variant="ghost"
                icon="retry"
                onPress={() => {
                  setPhoto(null);
                  setLook(null);
                  setColour(null);
                }}
              />
            </>
          ) : (
            <>
              <Button
                label="Take a selfie"
                icon="camera"
                onPress={() => {
                  setPreviewReady(false);
                  setCameraOpen(true);
                }}
              />
              <Button
                label="Choose a photo"
                variant="secondary"
                icon="gallery"
                onPress={() => void withCapture(() => camera.pickFromLibrary())}
              />
            </>
          )}

          <Text className="font-body text-micro text-muted">
            Your photo stays on this device and is only used for these previews.
            Nothing is uploaded.
          </Text>
        </View>

        {/* CONTROLS */}
        <View className="gap-lg">
          <Text
            accessibilityRole="header"
            className="font-body-semibold text-section tracking-section uppercase text-muted"
          >
            Try on
          </Text>

          <View className="flex-row flex-wrap gap-sm">
            <ModePill
              label="Makeup"
              active={mode === "makeup"}
              onPress={() => setMode("makeup")}
            />
            <ModePill
              label="Colours"
              active={mode === "colours"}
              onPress={() => setMode("colours")}
            />
            <ModePill label="Hair · soon" disabled />
          </View>

          <Text className="font-body text-sm text-body">
            {photo
              ? "Pick a shade to preview it against your own colouring."
              : "Add a photo to begin. Your palette, makeup tones, and styling direction, on your own features."}
          </Text>

          {mode === "makeup" ? (
            <>
              <View className="flex-row flex-wrap gap-sm">
                {MAKEUP_CATEGORIES.map((c) => (
                  <ModePill
                    key={c}
                    label={c}
                    active={category === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
              </View>
              <View className="gap-md">
                {looks.map((l) => (
                  <ShadeCard
                    key={l.id}
                    hex={l.hex}
                    name={l.name}
                    note={l.note}
                    active={look?.id === l.id}
                    onPress={() => setLook(l)}
                  />
                ))}
              </View>
            </>
          ) : (
            <View className="gap-lg">
              {(
                [
                  ["Best colours", palette.primary, "Ideal"],
                  ["Accents", palette.accents, "Accent"],
                  ["Neutrals", palette.neutrals, "Harmonizing"],
                ] as const
              ).map(([title, swatches, verdict]) => (
                <SwatchRow
                  key={title}
                  title={title}
                  swatches={swatches}
                  selectedHex={colour?.swatch.hex ?? null}
                  onSelect={(swatch) => setColour({ swatch, verdict })}
                />
              ))}

              {/* Not dimmed: a swatch faded to 80% is simply the wrong colour.
                  "Avoid" is carried by the heading and by these being inert. */}
              <View className="gap-md">
                <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                  Colours to avoid
                </Text>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  className="flex-row flex-wrap gap-sm"
                >
                  {palette.avoid.map((sw) => (
                    <View
                      key={`${sw.hex}-${sw.name}`}
                      // Case 1: the colour is member data.
                      style={{ backgroundColor: sw.hex }}
                      className="h-tap w-tap rounded-pill border border-border dark:border-border/12"
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          <View
            accessibilityLiveRegion="polite"
            className="rounded-panel border border-border bg-surface px-lg py-md dark:border-border/12"
          >
            {selectedName ? (
              <Text className="font-body text-sm text-body">
                <Text className="font-body-semibold text-ink">
                  {selectedName}
                </Text>
                {` — ${selectedNote ?? ""}`}
              </Text>
            ) : (
              <Text className="font-body text-sm text-muted">
                Pick a shade to preview it.
              </Text>
            )}
          </View>
        </View>

        <Button
          label="View your dossier"
          variant="secondary"
          onPress={() => router.navigate("/profile")}
        />
      </View>
    </Screen>
  );
}

/**
 * The shade, laid over the photo.
 *
 * React Native has no `mix-blend-mode`, so the web's soft-light wash is
 * approximated with a low-opacity gradient from `react-native-svg` — already a
 * dependency, and honest about what it is: a preview, not a render. The colours
 * mode keeps the web's drape, a solid band at the collar where a garment sits.
 *
 * ponytail: no per-feature blending. A true soft-light composite needs Skia,
 * which is a native dependency for one decorative effect.
 */
function ShadeOverlay({ hex, mode }: { hex: string; mode: Mode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="absolute inset-0"
    >
      <Svg width="100%" height="100%">
        <Defs>
          {mode === "makeup" ? (
            <RadialGradient id="shade" cx="50%" cy="0%" rx="120%" ry="85%">
              <Stop offset="0.35" stopColor={hex} stopOpacity={0} />
              <Stop offset="1" stopColor={hex} stopOpacity={0.4} />
            </RadialGradient>
          ) : (
            <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.62" stopColor={hex} stopOpacity={0} />
              <Stop offset="1" stopColor={hex} stopOpacity={0.95} />
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shade)" />
      </Svg>
    </View>
  );
}

function ModePill({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "active:opacity-85 min-h-tap items-center justify-center rounded-pill border px-lg",
        disabled
          ? "border-border opacity-50 dark:border-border/12"
          : active
            ? "border-ink bg-ink"
            : "border-border bg-surface dark:border-border/12",
      )}
    >
      <Text
        className={cn(
          "font-body-medium text-label tracking-label uppercase",
          disabled ? "text-muted" : active ? "text-on-ink" : "text-body",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A makeup shade. Selection is the check mark and the border, never the hue. */
function ShadeCard({
  hex,
  name,
  note,
  active,
  onPress,
}: {
  hex: string;
  name: string;
  note: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${note}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        "active:opacity-90 flex-row items-center gap-lg overflow-hidden rounded-panel border px-lg py-md",
        active
          ? "border-ink bg-accent-soft"
          : "border-border bg-surface dark:border-border/12",
      )}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Case 1: the colour is member data.
        style={{ backgroundColor: hex }}
        className="h-tap w-tap rounded-control border border-border dark:border-border/12"
      />
      <View className="flex-1 gap-xs">
        <Text className="font-body-medium text-base text-ink">{name}</Text>
        <Text className="font-body text-sm text-body">{note}</Text>
      </View>
      {active ? <Icon name="check" size="sm" color="ink" /> : null}
    </Pressable>
  );
}

function SwatchRow({
  title,
  swatches,
  selectedHex,
  onSelect,
}: {
  title: string;
  swatches: readonly NamedSwatch[];
  selectedHex: string | null;
  onSelect: (swatch: NamedSwatch) => void;
}) {
  return (
    <View className="gap-md">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-sm">
        {swatches.map((sw) => {
          const selected = selectedHex === sw.hex;
          return (
            <Pressable
              key={`${sw.hex}-${sw.name}`}
              accessibilityRole="button"
              accessibilityLabel={`${sw.name}, ${title}. ${sw.tip}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(sw)}
              // The ring is a second border, not a hue change: the swatch IS
              // the colour, so selection can never be carried by it (§11).
              style={{ backgroundColor: sw.hex }}
              className={cn(
                "active:opacity-85 h-tap w-tap items-center justify-center rounded-pill border",
                selected ? "border-ink" : "border-border dark:border-border/12",
              )}
            >
              {selected ? <Icon name="check" size="sm" color="onInk" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The loading, error, empty, and permission shells — one frame, one title. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <View className="py-lg">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          Try it on
        </Text>
      </View>
      <View className="flex-1 pb-lg">{children}</View>
      <View className="pb-xl">
        <Button
          label="View your dossier"
          variant="secondary"
          onPress={() => router.navigate("/profile")}
        />
      </View>
    </Screen>
  );
}
