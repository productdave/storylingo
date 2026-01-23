import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Linking,
  Modal,
  Text,
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
import { Spacing, BorderRadius, StoryBuddyColors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";
import { useLanguage, getStoryTranslation } from "@/context/LanguageContext";
import { useSubscription } from "@/context/SubscriptionContext";

type SessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TrialPromptModal({ visible, onStartTrial, onDismiss }: { 
  visible: boolean; 
  onStartTrial: () => void; 
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.iconContainer}>
            <Feather name="gift" size={40} color={StoryBuddyColors.primary} />
          </View>
          
          <Text style={modalStyles.title}>Enjoying the Story?</Text>
          <Text style={modalStyles.subtitle}>
            Start your free 7-day trial to continue enjoying unlimited magical stories!
          </Text>
          
          <View style={modalStyles.features}>
            <View style={modalStyles.featureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={modalStyles.featureText}>Unlimited stories</Text>
            </View>
            <View style={modalStyles.featureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={modalStyles.featureText}>All story collections</Text>
            </View>
            <View style={modalStyles.featureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={modalStyles.featureText}>Cancel anytime</Text>
            </View>
          </View>
          
          <Pressable style={modalStyles.button} onPress={onStartTrial}>
            <Text style={modalStyles.buttonText}>Start 7-Day Free Trial</Text>
          </Pressable>
          
          <Pressable style={modalStyles.dismissButton} onPress={onDismiss}>
            <Text style={modalStyles.dismissText}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Session">>();
  const { story } = route.params;
  const { language, t } = useLanguage();
  const { 
    hasActiveSubscription, 
    addListenTime,
    dailyLimitReached,
    dailyLimitSeconds,
    dailyListenTimeSeconds,
    status: subscriptionStatus,
  } = useSubscription();

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const listenTimeRef = useRef(0);
  const listenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dailyLimitCheckedRef = useRef(false);

  const pcRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<any>(null);

  const talkButtonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  // Auto-connect when screen mounts (triggered by story selection)
  useEffect(() => {
    if (Platform.OS === "web") {
      connectToRealtimeWeb();
    } else {
      connectToRealtimeNative();
    }

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (listenIntervalRef.current) {
        clearInterval(listenIntervalRef.current);
      }
    };
  }, []);

  // Track listen time when connecting or session is active
  useEffect(() => {
    const isTrial = subscriptionStatus === 'free_trial' || subscriptionStatus === 'extended_trial';
    const isTracking = (status === 'connecting' || isSessionActive) && !isPaused;
    
    if (isTracking) {
      listenIntervalRef.current = setInterval(() => {
        listenTimeRef.current += 1;
        
        // Save listen time every 10 seconds
        if (listenTimeRef.current % 10 === 0) {
          addListenTime(10);
        }
        
        // Check if daily limit reached (only for trial users)
        if (isTrial && !dailyLimitCheckedRef.current) {
          const totalToday = dailyListenTimeSeconds + listenTimeRef.current;
          if (totalToday >= dailyLimitSeconds) {
            dailyLimitCheckedRef.current = true;
            // Stop the session and show paywall
            if (listenIntervalRef.current) {
              clearInterval(listenIntervalRef.current);
            }
            stopSession();
            navigation.navigate('Paywall', { fromDailyLimit: true });
          }
        }
      }, 1000);
    } else {
      if (listenIntervalRef.current) {
        clearInterval(listenIntervalRef.current);
        listenIntervalRef.current = null;
      }
    }

    return () => {
      if (listenIntervalRef.current) {
        clearInterval(listenIntervalRef.current);
      }
    };
  }, [status, isSessionActive, isPaused, subscriptionStatus, dailyListenTimeSeconds, dailyLimitSeconds]);

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
      // Pass story variables that will be injected into the OpenAI prompt template
      const baseUrl = getApiUrl();
      const tokenUrl = new URL("/api/token", baseUrl);
      const response = await fetch(tokenUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: story.id,
          storyTitle: story.title,
          storyContext: story.context,
          macroBeats: story.macroBeats,
          language: language,
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

      // Create data channel for events BEFORE creating SDP offer
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      dc.onopen = () => {
        console.log("Data channel opened");
        
        // Automatically initiate the story by sending a message to the AI
        // This tells the AI which story was selected, language preference, and to greet the child
        const storyTranslation = getStoryTranslation(t, story.id);
        const languageInstruction = t.voiceAgent.languageInstruction;
        const initiationMessage = t.voiceAgent.initiationMessage
          .replace(/{storyTitle}/g, storyTranslation.title)
          .replace(/{languageInstruction}/g, languageInstruction);
        
        // Send a conversation item with the story initiation
        const createItemEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: initiationMessage,
              },
            ],
          },
        };
        dc.send(JSON.stringify(createItemEvent));
        console.log("Sent story initiation:", initiationMessage);
        
        // Trigger the AI to respond
        const responseEvent = {
          type: "response.create",
        };
        dc.send(JSON.stringify(responseEvent));
        console.log("Triggered AI response");
      };
      dc.onmessage = (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);
          console.log("OpenAI event:", data.type);
          
          // Update status based on server events
          if (data.type === "response.audio.delta" || data.type === "response.audio_transcript.delta") {
            setStatus("speaking");
          } else if (data.type === "response.done" || data.type === "input_audio_buffer.speech_started") {
            setStatus("listening");
          } else if (data.type === "session.created") {
            console.log("Session created successfully");
          } else if (data.type === "error") {
            console.error("OpenAI error:", data.error);
          }
        } catch (e) {
          // Non-JSON message, ignore
        }
      };
      dc.onerror = (error) => {
        console.error("Data channel error:", error);
      };
      dc.onclose = () => {
        console.log("Data channel closed");
        setIsSessionActive(false);
        setStatus("error");
        stopPulseAnimation();
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setStatus("listening");
          setIsSessionActive(true);
          startPulseAnimation();
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsSessionActive(false);
          setStatus("error");
          stopPulseAnimation();
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          setIsSessionActive(false);
          setStatus("error");
          stopPulseAnimation();
        }
      };

      // Get local audio stream
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = ms;
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 3: Exchange SDP with OpenAI Realtime API
      // Using the correct GA endpoint: /v1/realtime/calls
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
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

      // Connection handshake complete - status will update via onconnectionstatechange
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error("Connection error:", error);
      setStatus("error");
      Alert.alert(
        "Connection Error",
        "Could not connect to StoryTale. Please try again."
      );
    }
  }, [story, startPulseAnimation, stopPulseAnimation]);

  const connectToRealtimeNative = useCallback(async () => {
    // For native mobile, show a message that this feature works best on web
    // In a production app, you would implement react-native-webrtc or use a WebSocket fallback
    Alert.alert(
      "Voice Chat",
      "For the best voice experience, please use StoryTale in a web browser. Scan the QR code and choose 'Open in browser' instead of Expo Go.",
      [{ text: "OK", onPress: () => setStatus("idle") }]
    );
    setStatus("idle");
  }, []);

  const sendMessageToAI = (message: string) => {
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === "open") {
      const createItemEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      };
      dc.send(JSON.stringify(createItemEvent));
      console.log("Sent message to AI:", message);
      
      const responseEvent = {
        type: "response.create",
      };
      dc.send(JSON.stringify(responseEvent));
    }
  };

  const handleTalkPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Talk button now acts as pause/resume toggle
    if (isSessionActive) {
      if (isPaused) {
        // Resume the story
        sendMessageToAI(t.voiceAgent.resumeMessage);
        setIsPaused(false);
        startPulseAnimation();
      } else {
        // Pause the story
        sendMessageToAI(t.voiceAgent.pauseMessage);
        setIsPaused(true);
        stopPulseAnimation();
      }
    }
  };

  const handleTalkPressIn = () => {
    talkButtonScale.value = withSpring(0.95, { damping: 15 });
  };

  const handleTalkPressOut = () => {
    talkButtonScale.value = withSpring(1, { damping: 15 });
  };

  const handleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted; // Toggle: if muted, enable; if not muted, disable
      });
      setIsMuted(!isMuted);
    }
  };

  const stopSession = () => {
    // Close WebRTC connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Stop local audio stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    // Reset state
    setIsSessionActive(false);
    setStatus("idle");
    setIsMuted(false);
    setIsPaused(false);
    dataChannelRef.current = null;
    stopPulseAnimation();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopSession();
    navigation.replace("StorySelection");
  };

  const getStatusText = () => {
    // Show paused status when paused
    if (isPaused && isSessionActive) {
      return t.session.paused;
    }
    // Show muted status when muted
    if (isMuted && isSessionActive) {
      return t.session.muted;
    }
    
    switch (status) {
      case "connecting":
        return t.session.connecting;
      case "listening":
        return t.session.listening;
      case "speaking":
        return t.session.speaking;
      case "error":
        return t.session.connectionLost;
      default:
        return t.session.connecting;
    }
  };

  const getTalkButtonColor = () => {
    // Show paused color when paused
    if (isPaused && isSessionActive) {
      return ["#888888", "#AAAAAA"];
    }
    
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
  
  const getTalkButtonIcon = () => {
    // Show pause/play icon based on state
    if (isPaused && isSessionActive) {
      return "play";
    }
    if (status === "speaking") {
      return "volume-2";
    }
    return "pause";
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
                name={getTalkButtonIcon() as any}
                size={64}
                color="#FFFFFF"
              />
            </LinearGradient>
          </AnimatedPressable>
        </View>

        <View style={styles.controlsContainer}>
          <Pressable
            style={styles.controlButton}
            onPress={handleBack}
            testID="button-back"
          >
            <Feather
              name="arrow-left"
              size={20}
              color={StoryBuddyColors.textSecondary}
            />
            <ThemedText style={styles.controlButtonText}>{t.session.back}</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.controlButton, isMuted ? styles.muteButtonActive : null]}
            onPress={handleMute}
            testID="button-mute"
            disabled={!isSessionActive}
          >
            <Feather
              name={isMuted ? "mic-off" : "mic"}
              size={20}
              color={isMuted ? StoryBuddyColors.error : StoryBuddyColors.textSecondary}
            />
            <ThemedText
              style={[styles.controlButtonText, isMuted ? { color: StoryBuddyColors.error } : null]}
            >
              {isMuted ? t.session.unmute : t.session.mute}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 107, 157, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: StoryBuddyColors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  features: {
    alignSelf: "stretch",
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  featureText: {
    ...Typography.body,
    color: StoryBuddyColors.textPrimary,
  },
  button: {
    backgroundColor: StoryBuddyColors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.xl,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  dismissButton: {
    padding: Spacing.sm,
  },
  dismissText: {
    ...Typography.body,
    color: StoryBuddyColors.textSecondary,
  },
});

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
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.lg,
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
  muteButtonActive: {
    borderColor: StoryBuddyColors.error,
    backgroundColor: "rgba(255, 107, 157, 0.1)",
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: StoryBuddyColors.textSecondary,
  },
});
