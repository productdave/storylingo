import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAudioPermission } from "expo-audio";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StoryBuddyColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type SessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Session">>();
  const { story } = route.params;

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [permission, requestPermission] = useAudioPermission();

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const talkButtonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startPulseAnimation = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.2, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const stopPulseAnimation = useCallback(() => {
    cancelAnimation(pulseScale);
    cancelAnimation(glowOpacity);
    pulseScale.value = withSpring(1);
    glowOpacity.value = withTiming(0);
  }, []);

  const talkButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: talkButtonScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: glowOpacity.value,
  }));

  const connectToRealtime = useCallback(async () => {
    try {
      setStatus("connecting");

      const baseUrl = getApiUrl();
      const tokenUrl = new URL("/api/token", baseUrl);
      const response = await fetch(tokenUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: story.id,
          storyTitle: story.title,
          macroBeats: story.macroBeats,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get token");
      }

      const { client_secret } = await response.json();

      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

      const ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${client_secret.value}`,
      ]);

      ws.onopen = () => {
        setStatus("listening");
        setIsSessionActive(true);
        startPulseAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "response.audio.delta") {
            setStatus("speaking");
          } else if (data.type === "response.done") {
            setStatus("listening");
          } else if (data.type === "input_audio_buffer.speech_started") {
            setStatus("listening");
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
        stopPulseAnimation();
      };

      ws.onclose = () => {
        setIsSessionActive(false);
        setStatus("idle");
        stopPulseAnimation();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Connection error:", error);
      setStatus("error");
      Alert.alert(
        "Connection Error",
        "Could not connect to Story Buddy. Please try again."
      );
    }
  }, [story, startPulseAnimation, stopPulseAnimation]);

  const handleTalkPress = async () => {
    if (!permission?.granted) {
      if (permission?.canAskAgain) {
        const result = await requestPermission();
        if (!result.granted) {
          return;
        }
      } else {
        Alert.alert(
          "Microphone Access Required",
          "Story Buddy needs microphone access to hear your voice. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            ...(Platform.OS !== "web"
              ? [
                  {
                    text: "Open Settings",
                    onPress: async () => {
                      try {
                        await Linking.openSettings();
                      } catch (e) {
                        // Settings not available
                      }
                    },
                  },
                ]
              : []),
          ]
        );
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isSessionActive) {
      await connectToRealtime();
    }
  };

  const handleTalkPressIn = () => {
    talkButtonScale.value = withSpring(0.95, { damping: 15 });
  };

  const handleTalkPressOut = () => {
    talkButtonScale.value = withSpring(1, { damping: 15 });
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("End Story?", "Are you sure you want to stop the story?", [
      { text: "Keep Going", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          if (wsRef.current) {
            wsRef.current.close();
          }
          navigation.goBack();
        },
      },
    ]);
  };

  const handleStartAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (wsRef.current) {
      wsRef.current.close();
    }
    navigation.replace("StorySelection");
  };

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "Connecting...";
      case "listening":
        return "Listening...";
      case "speaking":
        return "Speaking...";
      case "error":
        return "Connection lost";
      default:
        return "Tap to start";
    }
  };

  const getTalkButtonColor = () => {
    switch (status) {
      case "listening":
        return [StoryBuddyColors.primary, "#FF8FB3"];
      case "speaking":
        return [StoryBuddyColors.secondary, "#FFE066"];
      case "connecting":
        return ["#B0A0C0", "#C0B0D0"];
      case "error":
        return [StoryBuddyColors.error, "#FF8888"];
      default:
        return [StoryBuddyColors.primary, "#FF8FB3"];
    }
  };

  if (!permission) {
    return (
      <LinearGradient
        colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.statusText}>Loading...</ThemedText>
        </View>
      </LinearGradient>
    );
  }

  if (!permission.granted && !permission.canAskAgain) {
    return (
      <LinearGradient
        colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
        style={styles.container}
      >
        <View
          style={[
            styles.permissionContainer,
            {
              paddingTop: headerHeight + Spacing.xl,
              paddingBottom: insets.bottom + Spacing["2xl"],
            },
          ]}
        >
          <Feather
            name="mic-off"
            size={64}
            color={StoryBuddyColors.textSecondary}
          />
          <ThemedText style={styles.permissionTitle}>
            Microphone Access Required
          </ThemedText>
          <ThemedText style={styles.permissionText}>
            Story Buddy needs to hear your voice to tell you stories. Please
            enable microphone access in Settings.
          </ThemedText>
          {Platform.OS !== "web" ? (
            <Pressable
              style={styles.settingsButton}
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch (e) {
                  // Settings not available
                }
              }}
            >
              <ThemedText style={styles.settingsButtonText}>
                Open Settings
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing["4xl"],
            paddingBottom: insets.bottom + Spacing["4xl"],
          },
        ]}
      >
        <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>

        <View style={styles.talkButtonContainer}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <AnimatedPressable
            onPress={handleTalkPress}
            onPressIn={handleTalkPressIn}
            onPressOut={handleTalkPressOut}
            style={[styles.talkButton, talkButtonStyle]}
            testID="button-talk"
          >
            <LinearGradient
              colors={getTalkButtonColor() as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.talkButtonGradient}
            >
              <Feather
                name={status === "speaking" ? "volume-2" : "mic"}
                size={64}
                color="#FFFFFF"
              />
            </LinearGradient>
          </AnimatedPressable>
        </View>

        <View style={styles.controlsContainer}>
          <Pressable
            style={styles.controlButton}
            onPress={handleStartAgain}
            testID="button-start-again"
          >
            <Feather
              name="refresh-cw"
              size={20}
              color={StoryBuddyColors.textSecondary}
            />
            <ThemedText style={styles.controlButtonText}>Start Again</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.controlButton, styles.stopButton]}
            onPress={handleStop}
            testID="button-stop"
          >
            <Feather name="square" size={20} color={StoryBuddyColors.error} />
            <ThemedText
              style={[styles.controlButtonText, { color: StoryBuddyColors.error }]}
            >
              Stop
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    gap: Spacing.lg,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: StoryBuddyColors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  permissionText: {
    fontSize: 16,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  settingsButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    backgroundColor: StoryBuddyColors.primary,
    borderRadius: BorderRadius.lg,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing["2xl"],
  },
  statusText: {
    fontSize: 16,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
  },
  talkButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: StoryBuddyColors.primary,
  },
  talkButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  talkButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    gap: Spacing["3xl"],
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: StoryBuddyColors.border,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  stopButton: {
    borderColor: StoryBuddyColors.error,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: StoryBuddyColors.textSecondary,
  },
});
