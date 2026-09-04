import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Text,
  Image,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  HoldToSpeakControl,
  type HoldToSpeakState,
} from "@/components/HoldToSpeakControl";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StoryBuddyColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";
import { useLanguage, getStoryTranslation } from "@/context/LanguageContext";
import { useProgress, ConversationMessage } from "@/context/ProgressContext";

type SessionStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Session">>();
  const { story } = route.params;
  const { language, t } = useLanguage();

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isHolding, setIsHolding] = useState(false); // true while child holds the mic button
  const [isPaused, setIsPaused] = useState(false);

  const { addSession, markStoryCompleted, saveTranscript } = useProgress();

  const pcRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<any>(null);

  const transcriptRef = useRef<ConversationMessage[]>([]);
  const currentAITextRef = useRef<string>("");
  const userTurnCountRef = useRef(0);

  // Cleanup on unmount only (connection is started by user tap)
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

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
          isInteractive: story.isInteractive || false,
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

        // Configure VAD to be less sensitive to background noise
        // threshold 0.7 (default 0.5) = only trigger on clear intentional speech
        // silence_duration_ms 800 = wait longer before treating silence as end of turn
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.85,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000,
              },
              input_audio_transcription: {
                model: "gpt-4o-mini-transcribe",
              },
            },
          }),
        );
        console.log("VAD config + transcription applied");

        transcriptRef.current = [];
        currentAITextRef.current = "";
        userTurnCountRef.current = 0;
        addSession(story.id);
      };
      dc.onmessage = (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);
          console.log("OpenAI event:", data.type);

          if (data.type === "response.audio_transcript.delta") {
            currentAITextRef.current += data.delta || "";
            setStatus("speaking");
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => {
                t.enabled = false;
              });
            }
            if (dataChannelRef.current?.readyState === "open") {
              dataChannelRef.current.send(
                JSON.stringify({
                  type: "session.update",
                  session: { turn_detection: null },
                }),
              );
              dataChannelRef.current.send(
                JSON.stringify({ type: "input_audio_buffer.clear" }),
              );
            }
          } else if (data.type === "response.audio.delta") {
            setStatus("speaking");
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => {
                t.enabled = false;
              });
            }
            if (dataChannelRef.current?.readyState === "open") {
              dataChannelRef.current.send(
                JSON.stringify({
                  type: "session.update",
                  session: { turn_detection: null },
                }),
              );
              dataChannelRef.current.send(
                JSON.stringify({ type: "input_audio_buffer.clear" }),
              );
            }
          } else if (data.type === "response.done") {
            if (currentAITextRef.current.trim()) {
              transcriptRef.current.push({
                role: "ai",
                text: currentAITextRef.current.trim(),
                timestamp: Date.now(),
              });
              currentAITextRef.current = "";
            }
            setStatus("listening");
            if (dataChannelRef.current?.readyState === "open") {
              dataChannelRef.current.send(
                JSON.stringify({
                  type: "session.update",
                  session: { turn_detection: null },
                }),
              );
            }
          } else if (
            data.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            const transcript = data.transcript?.trim();
            if (transcript) {
              transcriptRef.current.push({
                role: "user",
                text: transcript,
                timestamp: Date.now(),
              });
              userTurnCountRef.current += 1;
              if (userTurnCountRef.current >= 8) {
                markStoryCompleted(story.id);
              }
            }
          } else if (data.type === "session.created") {
            console.log("Session created successfully");
          } else if (data.type === "error") {
            console.error("OpenAI error:", data.error);
          }
        } catch {
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
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setStatus("listening");
          setIsSessionActive(true);
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setIsSessionActive(false);
          setStatus("error");
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          setIsSessionActive(false);
          setStatus("error");
        }
      };

      // Get local audio stream — must be called within a user gesture
      let ms: MediaStream;
      try {
        ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError: any) {
        pc.close();
        setStatus("idle");
        const isDenied =
          micError?.name === "NotAllowedError" ||
          micError?.name === "PermissionDeniedError";
        Alert.alert(
          "Microphone Required",
          isDenied
            ? "Microphone access was denied. Please allow microphone access in your browser settings, then tap the play button again."
            : "Could not access your microphone. Please check that your device has a working microphone and try again.",
          [{ text: "OK" }],
        );
        return;
      }
      localStreamRef.current = ms;
      ms.getTracks().forEach((track) => {
        track.enabled = false; // Muted by default until AI finishes speaking
        pc.addTrack(track, ms);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 3: Exchange SDP with OpenAI Realtime API
      // Using the correct GA endpoint: /v1/realtime/calls
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
        },
      );

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
        "Could not connect to StoryLingo. Please try again.",
      );
    }
  }, [addSession, language, markStoryCompleted, story, t]);

  const connectToRealtimeNative = useCallback(async () => {
    // For native mobile, show a message that this feature works best on web
    // In a production app, you would implement react-native-webrtc or use a WebSocket fallback
    Alert.alert(
      "Voice Chat",
      "For the best voice experience, please use StoryLingo in a web browser. Scan the QR code and choose 'Open in browser' instead of Expo Go.",
      [{ text: "OK", onPress: () => setStatus("idle") }],
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
    // Only used to START the session (idle / error state)
    if (status === "idle" || status === "error") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        connectToRealtimeWeb();
      } else {
        connectToRealtimeNative();
      }
    }
    // All active-session mic control is handled by pressIn/pressOut (push-to-talk)
  };

  const handleTalkPressIn = () => {
    // Push-to-talk: unmute mic while finger is held down (only during child's turn)
    if (isSessionActive && status !== "speaking" && !isPaused) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }
      setIsHolding(true);
      // Clear stale audio, then re-enable VAD so OpenAI can detect speech
      if (dataChannelRef.current?.readyState === "open") {
        dataChannelRef.current.send(
          JSON.stringify({ type: "input_audio_buffer.clear" }),
        );
        dataChannelRef.current.send(
          JSON.stringify({
            type: "session.update",
            session: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.85,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000,
              },
            },
          }),
        );
      }
    }
  };

  const handleTalkPressOut = () => {
    // Push-to-talk: mute mic when finger is released
    if (isSessionActive && isHolding) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      setIsHolding(false);
      // Commit audio buffer so OpenAI processes what was said, then disable VAD
      if (dataChannelRef.current?.readyState === "open") {
        dataChannelRef.current.send(
          JSON.stringify({ type: "input_audio_buffer.commit" }),
        );
        dataChannelRef.current.send(
          JSON.stringify({
            type: "session.update",
            session: { turn_detection: null },
          }),
        );
      }
    }
  };

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSessionActive) {
      if (isPaused) {
        sendMessageToAI(t.voiceAgent.resumeMessage);
        setIsPaused(false);
      } else {
        sendMessageToAI(t.voiceAgent.pauseMessage);
        setIsPaused(true);
      }
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
      localStreamRef.current.getTracks().forEach((track) => track.stop());
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
    setIsPaused(false);
    dataChannelRef.current = null;
  };

  const handleBack = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (transcriptRef.current.length > 0) {
      await saveTranscript(story.id, transcriptRef.current);
    }
    const transcript = [...transcriptRef.current];
    stopSession();
    if (transcript.length > 0) {
      navigation.replace("ConversationReview", { story, transcript });
    } else {
      navigation.replace("StorySelection");
    }
  };

  const getStatusText = () => {
    if (isPaused && isSessionActive) {
      return t.session.paused;
    }
    switch (status) {
      case "connecting":
        return t.session.connecting;
      case "speaking":
        return t.session.speaking;
      case "listening":
        return isHolding ? t.session.listening : t.session.holdToSpeak;
      case "error":
        return t.session.connectionLost;
      case "idle":
        return "Tap to begin";
      default:
        return t.session.connecting;
    }
  };

  const portalText = (t as any).portal?.[story.id] || t.session.connecting;

  const isConnectingOrIdle =
    status === "idle" || status === "connecting" || status === "error";
  const holdToSpeakState: HoldToSpeakState = isPaused
    ? "paused"
    : status === "speaking"
      ? "speaking"
      : isHolding
        ? "recording"
        : status === "listening"
          ? "ready"
          : status === "connecting"
            ? "connecting"
            : status === "error"
              ? "error"
              : "start";

  return (
    <View
      style={styles.container}
      // @ts-ignore: web-only prop to block long-press context menu on mobile Safari
      onContextMenu={(e: any) => e.preventDefault()}
    >
      <ImageBackground
        source={story.image}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={
            isConnectingOrIdle
              ? ["rgba(45, 27, 78, 0.75)", "rgba(45, 27, 78, 0.92)"]
              : ["rgba(45, 27, 78, 0.55)", "rgba(45, 27, 78, 0.85)"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.overlay}
        >
          <View
            style={[
              styles.content,
              {
                paddingTop: headerHeight + Spacing["3xl"],
                paddingBottom: insets.bottom + Spacing["3xl"],
              },
            ]}
          >
            {isConnectingOrIdle ? (
              /* ---- PORTAL / CONNECTING STATE ---- */
              <>
                <View style={styles.portalTopSpacer} />

                <View style={styles.portalCenter}>
                  <View style={styles.portalImageRing}>
                    <View style={styles.portalImageInner}>
                      <Image
                        source={story.image}
                        style={styles.portalCharacterImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>

                  <ThemedText style={styles.portalText}>
                    {status === "connecting" ? portalText : story.title}
                  </ThemedText>

                  {status === "error" && (
                    <ThemedText style={styles.portalSubtext}>
                      {t.session.connectionLost}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.portalBottom}>
                  {status === "idle" || status === "error" ? (
                    <Pressable
                      onPress={handleTalkPress}
                      onPressIn={handleTalkPressIn}
                      onPressOut={handleTalkPressOut}
                      style={styles.portalStartButton}
                      testID="button-talk"
                    >
                      <LinearGradient
                        colors={[StoryBuddyColors.primary, "#FF8FB3"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.portalStartGradient}
                      >
                        <Feather name="play" size={32} color="#FFFFFF" />
                        <Text style={styles.portalStartText}>
                          {status === "error" ? "Retry" : "Start Story"}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <View style={styles.connectingDots}>
                      <View style={styles.dot} />
                      <View style={[styles.dot, styles.dotDelay]} />
                      <View style={[styles.dot, styles.dotDelay2]} />
                    </View>
                  )}

                  <Pressable
                    style={styles.portalBackButton}
                    onPress={handleBack}
                    testID="button-back"
                  >
                    <Feather
                      name="arrow-left"
                      size={18}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.portalBackText}>{t.session.back}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              /* ---- ACTIVE SESSION STATE ---- */
              <>
                <View style={styles.sessionTopRow}>
                  <View style={styles.sessionCharacterBadge}>
                    <Image
                      source={story.image}
                      style={styles.sessionCharacterThumb}
                      resizeMode="cover"
                    />
                    <ThemedText style={styles.sessionStoryTitle}>
                      {story.title}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.statusText}>
                  {getStatusText()}
                </ThemedText>

                <View style={styles.talkButtonContainer}>
                  <HoldToSpeakControl
                    labels={{
                      start: "Tap to begin",
                      connecting: t.session.connecting,
                      hold: t.session.holdToSpeak,
                      listening: t.session.listening,
                      processing: t.session.connecting,
                      speaking: t.session.speaking,
                      paused: t.session.paused,
                      error: t.session.connectionLost,
                    }}
                    onHoldEnd={handleTalkPressOut}
                    onHoldStart={handleTalkPressIn}
                    onStart={handleTalkPress}
                    state={holdToSpeakState}
                    testID="button-talk"
                  />
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
                      color="rgba(255,255,255,0.7)"
                    />
                    <ThemedText style={styles.controlButtonText}>
                      {t.session.back}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.controlButton,
                      isPaused ? styles.pauseButtonActive : null,
                    ]}
                    onPress={handlePause}
                    testID="button-pause"
                    disabled={!isSessionActive}
                  >
                    <Feather
                      name={isPaused ? "play" : "pause"}
                      size={20}
                      color={
                        isPaused
                          ? StoryBuddyColors.primary
                          : "rgba(255,255,255,0.7)"
                      }
                    />
                    <ThemedText
                      style={[
                        styles.controlButtonText,
                        isPaused ? { color: StoryBuddyColors.primary } : null,
                      ]}
                    >
                      {isPaused ? t.session.resume : t.session.pause}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D1B4E",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    // @ts-ignore: web-only properties to prevent long-press context menu on mobile browsers
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  },
  overlay: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing["2xl"],
  },

  // ---- PORTAL / CONNECTING STATE ----
  portalTopSpacer: {
    height: 40,
  },
  portalCenter: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  portalImageRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: "rgba(255, 107, 157, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 107, 157, 0.15)",
  },
  portalImageInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
  },
  portalCharacterImage: {
    width: "100%",
    height: "100%",
  },
  portalText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  portalSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  portalBottom: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  portalStartButton: {
    borderRadius: BorderRadius["2xl"],
    overflow: "hidden",
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  portalStartGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
  },
  portalStartText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  connectingDots: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: StoryBuddyColors.primary,
  },
  dotDelay: {
    opacity: 0.6,
  },
  dotDelay2: {
    opacity: 0.3,
  },
  portalBackButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  portalBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },

  // ---- ACTIVE SESSION STATE ----
  sessionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  sessionCharacterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  sessionCharacterThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sessionStoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statusText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  talkButtonContainer: {
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
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  pauseButtonActive: {
    borderColor: StoryBuddyColors.primary,
    backgroundColor: "rgba(255, 107, 157, 0.2)",
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
});
