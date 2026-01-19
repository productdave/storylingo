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

  const pcRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const talkButtonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
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

  const connectToRealtimeWeb = useCallback(async () => {
    try {
      setStatus("connecting");

      // Step 1: Get ephemeral token from our backend
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
        const errorData = await response.json();
        console.error("Token error:", errorData);
        throw new Error("Failed to get token");
      }

      const { client_secret } = await response.json();

      // Step 2: Create WebRTC peer connection (web only)
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Set up audio element to play remote audio
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Get local audio stream
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 3: Exchange SDP with OpenAI Realtime API
      // Using the correct GA endpoint: /v1/realtime
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${client_secret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error("WebRTC error:", errorText);
        throw new Error("Failed to establish WebRTC connection");
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Connection established
      setStatus("listening");
      setIsSessionActive(true);
      startPulseAnimation();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsSessionActive(false);
          setStatus("error");
          stopPulseAnimation();
        }
      };

    } catch (error) {
      console.error("Connection error:", error);
      setStatus("error");
      Alert.alert(
        "Connection Error",
        "Could not connect to Story Buddy. Please try again."
      );
    }
  }, [story, startPulseAnimation, stopPulseAnimation]);

  const connectToRealtimeNative = useCallback(async () => {
    // For native mobile, show a message that this feature works best on web
    // In a production app, you would implement react-native-webrtc or use a WebSocket fallback
    Alert.alert(
      "Voice Chat",
      "For the best voice experience, please use Story Buddy in a web browser. Scan the QR code and choose 'Open in browser' instead of Expo Go.",
      [{ text: "OK", onPress: () => setStatus("idle") }]
    );
    setStatus("idle");
  }, []);

  const handleTalkPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isSessionActive) {
      if (Platform.OS === "web") {
        await connectToRealtimeWeb();
      } else {
        await connectToRealtimeNative();
      }
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
          if (pcRef.current) {
            pcRef.current.close();
          }
          navigation.goBack();
        },
      },
    ]);
  };

  const handleStartAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pcRef.current) {
      pcRef.current.close();
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
