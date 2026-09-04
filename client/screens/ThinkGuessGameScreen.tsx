import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  HoldToSpeakControl,
  type HoldToSpeakState,
} from "@/components/HoldToSpeakControl";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing, StoryBuddyColors } from "@/constants/theme";
import { useLanguage } from "@/context/LanguageContext";
import { useProgress } from "@/context/ProgressContext";
import { useThinkGuessVoice } from "@/hooks/useThinkGuessVoice";
import {
  createThinkGuessRound,
  emitThinkGuessEvent,
  stopThinkGuessRound,
  submitThinkGuessTurn,
} from "@/lib/think-guess";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type {
  CreateRoundResponse,
  TurnDecision,
  VoiceState,
} from "@shared/thinkGuess";

function stateLabel(
  state: VoiceState,
  isConnected: boolean,
  t: ReturnType<typeof useLanguage>["t"],
): string {
  switch (state) {
    case "connecting":
      return t.session.connecting;
    case "ai_speaking":
      return t.thinkGuess.speaking;
    case "child_speaking":
      return t.thinkGuess.listening;
    case "ai_thinking":
      return t.thinkGuess.thinking;
    case "round_complete":
      return t.thinkGuess.roundComplete;
    case "error":
      return t.session.connectionLost;
    case "idle":
      return isConnected ? t.thinkGuess.holdToSpeak : t.thinkGuess.startVoice;
    default:
      return t.thinkGuess.holdToSpeak;
  }
}

export default function ThinkGuessGameScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, t } = useLanguage();
  const { getThinkGuessProgress, recordThinkGuessRound } = useProgress();
  const [round, setRound] = useState<CreateRoundResponse | null>(null);
  const [prompt, setPrompt] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<TurnDecision["completion"]>();
  const [usefulQuestions, setUsefulQuestions] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [dontKnowCount, setDontKnowCount] = useState(0);
  const completionRecorded = useRef(false);
  const initialRoundStarted = useRef(false);
  const mascotScale = useSharedValue(1);
  const mascotRotation = useSharedValue(0);

  const handleVoiceError = useCallback(
    (message: string) => setError(message),
    [],
  );

  const processTranscript = useCallback(
    async (transcript: string, confidence?: number) => {
      if (!round) return;
      setHeard(transcript);
      setError(null);
      voice.setVoiceState("ai_thinking");
      try {
        const decision = await submitThinkGuessTurn(
          round.roundId,
          transcript,
          confidence,
        );
        setPrompt(decision.reply);
        if (decision.intent === "question")
          setUsefulQuestions((value) => value + 1);
        if (decision.intent === "request_hint")
          setHintsUsed(decision.hintLevel);
        if (decision.intent === "dont_know")
          setDontKnowCount((value) => value + 1);
        if (decision.completion) {
          setResult(decision.completion);
          voice.setVoiceState("round_complete");
          if (!completionRecorded.current) {
            completionRecorded.current = true;
            void recordThinkGuessRound({
              solved: decision.completion.solved,
              abandoned: false,
              usefulQuestions: decision.completion.usefulQuestions,
              hintsUsed: decision.completion.hintsUsed,
              dontKnowCount,
            });
          }
        }
        voice.speak(decision.reply);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "The mystery could not continue.";
        if (message.includes("ROUND_EXPIRED") || message.startsWith("410")) {
          setError("This mystery expired. Start a new one to keep playing.");
        } else {
          setError(message);
        }
        voice.setVoiceState("error");
      }
    },
    // The voice hook's action callbacks are stable; depending on its wrapper object
    // would recreate this handler on every voice-state render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dontKnowCount, recordThinkGuessRound, round],
  );

  const voice = useThinkGuessVoice({
    roundId: round?.roundId ?? null,
    onTranscript: processTranscript,
    onError: handleVoiceError,
  });
  const disconnectVoice = voice.disconnect;
  const setVoiceState = voice.setVoiceState;

  const startRound = useCallback(async () => {
    disconnectVoice();
    setLoading(true);
    setError(null);
    setHeard(null);
    setResult(undefined);
    setUsefulQuestions(0);
    setHintsUsed(0);
    setDontKnowCount(0);
    completionRecorded.current = false;
    try {
      const progress = getThinkGuessProgress();
      const created = await createThinkGuessRound({
        mode: "child_guesses",
        language,
        languageLevel: progress.languageLevel,
        reasoningLevel: progress.reasoningLevel,
      });
      setRound(created);
      setPrompt(created.opening);
      setVoiceState("idle");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not choose a mystery.",
      );
      setRound(null);
    } finally {
      setLoading(false);
    }
  }, [disconnectVoice, getThinkGuessProgress, language, setVoiceState]);

  useEffect(() => {
    if (initialRoundStarted.current) return;
    initialRoundStarted.current = true;
    void startRound();
  }, [startRound]);

  useEffect(() => {
    if (voice.voiceState === "ai_speaking") {
      mascotScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 350 }),
          withTiming(0.98, { duration: 350 }),
        ),
        -1,
        true,
      );
      mascotRotation.value = 0;
    } else if (voice.voiceState === "ai_thinking") {
      mascotRotation.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 450 }),
          withTiming(3, { duration: 450 }),
        ),
        -1,
        true,
      );
      mascotScale.value = withTiming(1);
    } else if (voice.voiceState === "round_complete") {
      mascotScale.value = withSequence(
        withTiming(1.15, { duration: 250 }),
        withTiming(1, { duration: 300 }),
      );
      mascotRotation.value = 0;
    } else {
      mascotScale.value = withTiming(1);
      mascotRotation.value = withTiming(0);
    }
  }, [mascotRotation, mascotScale, voice.voiceState]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mascotScale.value },
      { rotate: `${mascotRotation.value}deg` },
    ],
  }));

  const exit = async (destination: "Home" | "ThinkGuessMode") => {
    if (round && !result) {
      try {
        await stopThinkGuessRound(round.roundId);
      } catch {
        /* The UI must still exit immediately. */
      }
      if (!completionRecorded.current) {
        completionRecorded.current = true;
        await recordThinkGuessRound({
          solved: false,
          abandoned: true,
          usefulQuestions,
          hintsUsed,
          dontKnowCount,
        });
      }
    }
    voice.disconnect();
    if (destination === "ThinkGuessMode") {
      navigation.goBack();
    } else {
      navigation.popToTop();
    }
  };

  const requestHint = () => {
    if (!round || result) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void processTranscript(t.thinkGuess.giveClue);
  };

  const revealAnswer = () => {
    if (!round || result || hintsUsed < 3) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void processTranscript(t.thinkGuess.tellMeAnswer);
  };

  const holdToSpeakState: HoldToSpeakState = result
    ? "complete"
    : loading || voice.voiceState === "connecting"
      ? "connecting"
      : voice.voiceState === "child_speaking"
        ? "recording"
        : voice.voiceState === "ai_speaking"
          ? "speaking"
          : voice.voiceState === "ai_thinking"
            ? "processing"
            : voice.voiceState === "error" || error
              ? "error"
              : voice.isConnected
                ? "ready"
                : "start";

  return (
    <LinearGradient
      colors={["#251744", "#3A2462", "#1A1030"]}
      style={styles.container}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => {
            void exit("ThinkGuessMode");
          }}
          style={styles.topButton}
          testID="think-guess-exit"
        >
          <Feather name="x" size={24} color="#FFFFFF" />
          <ThemedText style={styles.topButtonText}>
            {t.thinkGuess.exit}
          </ThemedText>
        </Pressable>
        <View style={styles.modeBadge}>
          <Feather name="search" size={15} color="#E8DEFF" />
          <ThemedText style={styles.modeBadgeText}>
            {t.thinkGuess.iGuessTitle}
          </ThemedText>
        </View>
        <View style={styles.topSpacer} />
      </View>

      <View
        style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <View style={styles.characterArea}>
          <Animated.View style={[styles.mascotFrame, mascotStyle]}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.mascot}
            />
          </Animated.View>
          <ThemedText style={styles.stateText}>
            {loading
              ? t.thinkGuess.loading
              : stateLabel(voice.voiceState, voice.isConnected, t)}
          </ThemedText>
        </View>

        <View style={styles.promptCard} testID="think-guess-prompt">
          <Feather
            name={result ? "star" : "message-circle"}
            size={22}
            color={result ? "#E49B19" : "#7357D9"}
          />
          <ThemedText style={styles.promptText}>
            {prompt || t.thinkGuess.loading}
          </ThemedText>
        </View>
        {heard && !result ? (
          <View style={styles.heardPill}>
            <ThemedText style={styles.heardLabel}>
              {t.thinkGuess.heard}:
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.heardText}>
              “{heard}”
            </ThemedText>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorCard} testID="think-guess-error">
            <Feather name="alert-circle" size={18} color="#FFB4B4" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void startRound();
              }}
              style={styles.retryButton}
              testID="think-guess-retry"
            >
              <ThemedText style={styles.retryText}>
                {t.thinkGuess.tryAgain}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {hintsUsed >= 3 && !result ? (
          <Pressable
            accessibilityRole="button"
            disabled={
              loading ||
              voice.voiceState === "ai_speaking" ||
              voice.voiceState === "ai_thinking"
            }
            onPress={revealAnswer}
            style={styles.revealButton}
            testID="think-guess-reveal-answer"
          >
            <Feather name="eye" size={19} color="#FFFFFF" />
            <ThemedText style={styles.revealButtonText}>
              {t.thinkGuess.tellMeAnswer}
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.voiceArea}>
          <HoldToSpeakControl
            disabled={
              loading ||
              !!result ||
              voice.voiceState === "connecting" ||
              voice.voiceState === "ai_speaking" ||
              voice.voiceState === "ai_thinking"
            }
            labels={{
              start: t.thinkGuess.startVoice,
              connecting: t.session.connecting,
              hold: t.thinkGuess.holdToSpeak,
              listening: t.thinkGuess.listening,
              processing: t.thinkGuess.thinking,
              speaking: t.thinkGuess.speaking,
              paused: t.session.paused,
              error: t.session.connectionLost,
              complete: t.thinkGuess.roundComplete,
            }}
            onHoldEnd={() => {
              voice.stopTalking();
            }}
            onHoldStart={() => {
              voice.startTalking();
            }}
            onStart={() => {
              if (!round) return;
              setError(null);
              if (voice.isConnected) voice.disconnect();
              void voice.connect(prompt);
            }}
            state={holdToSpeakState}
            testID="think-guess-talk"
          />
        </View>

        <View style={styles.controls}>
          <Pressable
            disabled={loading || !!result}
            onPress={requestHint}
            style={styles.controlButton}
            testID="think-guess-hint"
          >
            <Feather name="help-circle" size={20} color="#FFFFFF" />
            <ThemedText style={styles.controlText}>
              {t.thinkGuess.giveClue}
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!voice.isConnected || !prompt}
            onPress={() => voice.speak(prompt)}
            style={styles.controlButton}
            testID="think-guess-repeat"
          >
            <Feather name="repeat" size={20} color="#FFFFFF" />
            <ThemedText style={styles.controlText}>
              {t.thinkGuess.repeat}
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!voice.isConnected}
            onPress={voice.toggleMute}
            style={styles.controlButton}
            testID="think-guess-mute"
          >
            <Feather
              name={voice.isMuted ? "volume-2" : "volume-x"}
              size={20}
              color="#FFFFFF"
            />
            <ThemedText style={styles.controlText}>
              {voice.isMuted ? t.thinkGuess.unmute : t.thinkGuess.mute}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {result ? (
        <View style={styles.resultBackdrop} testID="think-guess-result">
          <View
            style={[
              styles.resultCard,
              { paddingBottom: Math.max(insets.bottom, Spacing.xl) },
            ]}
          >
            <View style={styles.celebrationIcon}>
              <Feather
                name={result.solved ? "star" : "eye"}
                size={42}
                color="#FFFFFF"
              />
            </View>
            <ThemedText style={styles.resultTitle}>
              {result.solved
                ? t.thinkGuess.roundComplete
                : t.thinkGuess.answerRevealed}
            </ThemedText>
            <ThemedText style={styles.resultAnswer}>
              {result.canonicalAnswer}
            </ThemedText>
            <ThemedText style={styles.resultMessage}>{prompt}</ThemedText>
            <Pressable
              onPress={() => {
                void emitThinkGuessEvent({
                  event: "think_guess_replay_tapped",
                  language,
                  languageLevel: getThinkGuessProgress().languageLevel,
                  reasoningLevel: getThinkGuessProgress().reasoningLevel,
                  timestamp: Date.now(),
                });
                void startRound();
              }}
              style={styles.primaryAction}
              testID="think-guess-play-again"
            >
              <ThemedText style={styles.primaryActionText}>
                {t.thinkGuess.playAgain}
              </ThemedText>
            </Pressable>
            <View style={styles.resultActions}>
              <Pressable
                onPress={() => {
                  void exit("ThinkGuessMode");
                }}
                style={styles.secondaryAction}
              >
                <ThemedText style={styles.secondaryActionText}>
                  {t.thinkGuess.chooseGameAction}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  void exit("Home");
                }}
                style={styles.secondaryAction}
              >
                <ThemedText style={styles.secondaryActionText}>
                  {t.thinkGuess.done}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  topButton: {
    minWidth: 70,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  topButtonText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "700",
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modeBadgeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  topSpacer: { width: 70 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  characterArea: { alignItems: "center" },
  mascotFrame: {
    width: 116,
    height: 116,
    borderRadius: 40,
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  mascot: { width: "100%", height: "100%", borderRadius: 34 },
  stateText: {
    marginTop: Spacing.sm,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontWeight: "700",
  },
  promptCard: {
    width: "100%",
    maxWidth: 420,
    minHeight: 92,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  promptText: {
    flex: 1,
    color: StoryBuddyColors.textPrimary,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
  },
  heardPill: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heardLabel: { color: "rgba(255,255,255,0.58)", fontSize: 12 },
  heardText: {
    maxWidth: 240,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  errorCard: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,80,100,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,130,140,0.3)",
  },
  errorText: { flex: 1, color: "#FFD5D9", fontSize: 13, lineHeight: 18 },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  revealButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "#7357D9",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  revealButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  voiceArea: { alignItems: "center" },
  controls: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  controlButton: {
    flex: 1,
    maxWidth: 132,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  controlText: {
    color: "#FFFFFF",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "700",
  },
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16,8,31,0.72)",
  },
  resultCard: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    backgroundColor: "#FFF9F1",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  celebrationIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -68,
    backgroundColor: "#F2B134",
    borderWidth: 5,
    borderColor: "#FFF9F1",
  },
  resultTitle: {
    marginTop: Spacing.md,
    color: StoryBuddyColors.textPrimary,
    fontFamily: "FredokaOne_400Regular",
    fontSize: 29,
  },
  resultAnswer: {
    marginTop: Spacing.xs,
    color: "#7357D9",
    fontSize: 25,
    fontWeight: "900",
  },
  resultMessage: {
    marginVertical: Spacing.lg,
    color: StoryBuddyColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryAction: {
    width: "100%",
    maxWidth: 380,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    backgroundColor: StoryBuddyColors.primary,
  },
  primaryActionText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  resultActions: {
    width: "100%",
    maxWidth: 380,
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: StoryBuddyColors.border,
    backgroundColor: "#FFFFFF",
  },
  secondaryActionText: {
    color: StoryBuddyColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
