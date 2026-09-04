import React, { useEffect, useRef } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { PushToTalkButton } from "@/components/PushToTalkButton";
import { StoryBuddyColors } from "@/constants/theme";

export type HoldToSpeakState =
  | "start"
  | "connecting"
  | "ready"
  | "recording"
  | "processing"
  | "speaking"
  | "paused"
  | "error"
  | "complete";

export type HoldToSpeakLabels = {
  start: string;
  connecting: string;
  hold: string;
  listening: string;
  processing: string;
  speaking: string;
  paused: string;
  error: string;
  complete?: string;
};

type Props = {
  state: HoldToSpeakState;
  labels: HoldToSpeakLabels;
  onStart?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
  testID?: string;
  showInactiveLabel?: boolean;
  style?: ViewStyle;
};

const READY_COLORS: [string, string] = ["#B0A0C0", "#C0B0D0"];

function getPresentation(state: HoldToSpeakState): {
  colors: [string, string];
  icon: keyof typeof Feather.glyphMap;
} {
  switch (state) {
    case "start":
    case "error":
      return {
        colors: [StoryBuddyColors.primary, "#FF8FB3"],
        icon: "play",
      };
    case "recording":
      return { colors: ["#FF3366", "#FF6B9D"], icon: "mic" };
    case "speaking":
      return {
        colors: [StoryBuddyColors.secondary, "#FFE066"],
        icon: "volume-2",
      };
    case "paused":
      return { colors: ["#888888", "#AAAAAA"], icon: "play" };
    case "ready":
    case "connecting":
    case "processing":
    case "complete":
      return { colors: READY_COLORS, icon: "mic-off" };
  }
}

function getLabel(state: HoldToSpeakState, labels: HoldToSpeakLabels) {
  switch (state) {
    case "start":
      return labels.start;
    case "connecting":
      return labels.connecting;
    case "ready":
      return labels.hold;
    case "recording":
      return labels.listening;
    case "processing":
      return labels.processing;
    case "speaking":
      return labels.speaking;
    case "paused":
      return labels.paused;
    case "error":
      return labels.error;
    case "complete":
      return labels.complete ?? labels.processing;
  }
}

/**
 * Shared StoryLingo push-to-talk experience.
 *
 * Screens own their voice transport and map it to this small visual state
 * machine. This component owns the child-facing interaction: generous touch
 * target, readiness pulse, press feedback, haptics, and hold-state guidance.
 */
export function HoldToSpeakControl({
  state,
  labels,
  onStart,
  onHoldStart,
  onHoldEnd,
  disabled = false,
  size = 180,
  iconSize = 64,
  testID,
  showInactiveLabel = false,
  style,
}: Props) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const holdStarted = useRef(false);
  const canHold = (state === "ready" || state === "recording") && !disabled;
  const canStart = (state === "start" || state === "error") && !disabled;
  const showHoldHint = state === "ready" || state === "recording";
  const label = getLabel(state, labels);
  const presentation = getPresentation(state);
  const ringSize = size + 20;
  const wrapperSize = size + 40;

  useEffect(() => {
    if (canHold) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.2, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withSpring(1);
      pulseOpacity.value = withTiming(0);
    }

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, [canHold, pulseOpacity, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.buttonWrapper,
          { width: wrapperSize, height: wrapperSize },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
            },
            pulseStyle,
          ]}
        />
        <PushToTalkButton
          accessibilityLabel={label}
          colors={presentation.colors}
          disabled={disabled}
          icon={presentation.icon}
          iconSize={iconSize}
          onPress={() => {
            if (!canStart) return;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStart?.();
          }}
          onPressIn={() => {
            if (!canHold) return;
            holdStarted.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onHoldStart?.();
          }}
          onPressOut={() => {
            if (!holdStarted.current) return;
            holdStarted.current = false;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onHoldEnd?.();
          }}
          size={size}
          testID={testID}
        />
      </View>

      {showHoldHint ? (
        <View
          style={styles.holdHint}
          testID={testID ? `${testID}-hint` : undefined}
        >
          <Feather
            color={state === "recording" ? "#FF3366" : "rgba(255,255,255,0.7)"}
            name={state === "recording" ? "radio" : "mic"}
            size={14}
          />
          <ThemedText
            selectable={false}
            style={[
              styles.holdHintText,
              state === "recording" && styles.holdHintTextActive,
            ]}
          >
            {label}
          </ThemedText>
        </View>
      ) : showInactiveLabel ? (
        <ThemedText style={styles.inactiveLabel}>{label}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  buttonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    backgroundColor: StoryBuddyColors.primary,
  },
  holdHint: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  holdHintText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
  },
  holdHintTextActive: {
    color: "#FF3366",
    fontWeight: "600",
  },
  inactiveLabel: {
    marginTop: 8,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
