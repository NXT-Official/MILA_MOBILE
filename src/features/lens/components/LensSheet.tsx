import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { cn } from "@/utils/cn";

import { LENS_COPY, LENS_MODES, type LensMode } from "../modes";

/**
 * The Studio Lens entry sheet — the web's `StudioCameraDrawer`, as a bottom
 * sheet (§4: every dialog in Mila is one).
 *
 * Same three exits as the web: the Daily Drop dual capture, a Style Analysis
 * capture, and a Dupe Hunter capture, with the gallery as the alternative to
 * the shutter. The camera itself is not embedded here — on a phone it presents
 * full-screen so it is not letterboxed by a sheet inside a tab bar — so each
 * exit closes the sheet and routes.
 */
export function LensSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<LensMode>("analysis");
  const haptics = useHaptics();
  const copy = LENS_COPY[mode];

  function openCapture(source: "camera" | "gallery") {
    onClose();
    router.push({ pathname: "/lens-capture", params: { mode, source } });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={copy.title} height="82%">
      <View className="gap-xl">
        <Text className="font-body text-base text-body">{copy.description}</Text>

        {/* The daily post, above the mode toggle exactly as the web has it: it
            is the one action here that costs nothing and is not a Lens read. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post today's OOTD with a dual capture"
          onPress={() => {
            onClose();
            router.push("/publish");
          }}
          className="active:opacity-85 min-h-tap flex-row items-center justify-between gap-md rounded-panel border border-border bg-surface-alt px-lg py-md dark:border-border/12"
        >
          <View className="flex-row items-center gap-md">
            <View className="h-tap w-tap items-center justify-center rounded-pill border border-border dark:border-border/12">
              <Icon name="camera" size="sm" color="ink" />
            </View>
            <View className="gap-xs">
              <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                Daily drop
              </Text>
              <Text className="font-display text-base text-ink">Post today&apos;s OOTD</Text>
            </View>
          </View>
          <Icon name="forward" size="sm" color="muted" />
        </Pressable>

        <ModeToggle
          mode={mode}
          onChange={(next) => {
            haptics.selection();
            setMode(next);
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.action}
          onPress={() => openCapture("camera")}
          className="active:opacity-85 items-center gap-md rounded-card border border-border bg-surface-alt px-lg py-xl dark:border-border/12"
        >
          <View className="h-3xl w-3xl items-center justify-center rounded-pill border border-border bg-surface dark:border-border/12">
            <Icon name="camera" size="lg" color="ink" />
          </View>
          <Text className="font-display text-h3 text-ink">{copy.action}</Text>
          <Text className="text-center font-body text-sm text-body">{copy.actionHint}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo from your gallery"
          onPress={() => openCapture("gallery")}
          className="active:opacity-60 min-h-tap flex-row items-center justify-center gap-sm"
        >
          <Icon name="gallery" size="sm" color="muted" />
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Or choose a photo from gallery
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/**
 * Two segments, never a dropdown: both modes are always visible, which is what
 * teaches the second one exists. The selected state carries weight and colour
 * together — no state is ever encoded in hue alone (§11).
 */
function ModeToggle({ mode, onChange }: { mode: LensMode; onChange: (next: LensMode) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row rounded-pill border border-border bg-canvas p-xs dark:border-border/12"
    >
      {LENS_MODES.map((option) => {
        const active = option.id === mode;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            className={cn(
              "min-h-tap flex-1 items-center justify-center rounded-pill px-md",
              active && "bg-surface",
            )}
          >
            <Text
              className={cn(
                "text-section tracking-section uppercase",
                active ? "font-body-semibold text-ink" : "font-body text-muted",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
