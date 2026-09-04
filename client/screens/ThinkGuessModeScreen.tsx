import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BorderRadius, Spacing, StoryBuddyColors } from "@/constants/theme";
import { useLanguage } from "@/context/LanguageContext";
import { useProgress } from "@/context/ProgressContext";
import { emitThinkGuessEvent } from "@/lib/think-guess";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function ThinkGuessModeScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, t } = useLanguage();
  const { getThinkGuessProgress } = useProgress();

  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const progress = getThinkGuessProgress();
    void emitThinkGuessEvent({
      event: "think_guess_mode_selected",
      language,
      languageLevel: progress.languageLevel,
      reasoningLevel: progress.reasoningLevel,
      timestamp: Date.now(),
    });
    navigation.navigate("ThinkGuessGame");
  };

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      style={styles.container}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          testID="think-guess-back"
        >
          <Feather
            name="arrow-left"
            size={23}
            color={StoryBuddyColors.textPrimary}
          />
        </Pressable>
        <LanguageSwitcher />
        <Pressable
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate("Settings")}
          style={styles.iconButton}
        >
          <Feather
            name="settings"
            size={22}
            color={StoryBuddyColors.textPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.mascot}
        />
        <ThemedText style={styles.title}>{t.thinkGuess.chooseGame}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {t.thinkGuess.modeSubtitle}
        </ThemedText>

        <Pressable
          onPress={start}
          style={styles.modeCard}
          testID="mode-i-guess"
        >
          <LinearGradient
            colors={["#7357D9", "#9C7BFF"]}
            style={styles.modeIcon}
          >
            <Feather name="search" size={34} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.modeCopy}>
            <ThemedText style={styles.modeTitle}>
              {t.thinkGuess.iGuessTitle}
            </ThemedText>
            <ThemedText style={styles.modeDescription}>
              {t.thinkGuess.iGuessDescription}
            </ThemedText>
            <View style={styles.startPill} testID="think-guess-start-game">
              <ThemedText style={styles.startPillText}>
                {t.thinkGuess.startGame}
              </ThemedText>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        <View
          accessibilityState={{ disabled: true }}
          style={[styles.modeCard, styles.disabledCard]}
          testID="mode-ai-guesses-disabled"
        >
          <View style={[styles.modeIcon, styles.disabledIcon]}>
            <Feather name="message-circle" size={34} color="#867995" />
          </View>
          <View style={styles.modeCopy}>
            <View style={styles.titleRow}>
              <ThemedText style={[styles.modeTitle, styles.disabledText]}>
                {t.thinkGuess.aiGuessesTitle}
              </ThemedText>
              <View style={styles.comingSoon}>
                <ThemedText style={styles.comingSoonText}>
                  {t.thinkGuess.comingSoon}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.modeDescription, styles.disabledText]}>
              {t.thinkGuess.aiGuessesDescription}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  mascot: { width: 112, height: 112, borderRadius: 35 },
  title: {
    fontFamily: "FredokaOne_400Regular",
    fontSize: 30,
    lineHeight: 38,
    color: StoryBuddyColors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: -Spacing.md,
    color: StoryBuddyColors.textSecondary,
    fontSize: 16,
  },
  modeCard: {
    width: "100%",
    maxWidth: 420,
    minHeight: 160,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "rgba(115,87,217,0.18)",
    shadowColor: "#4D3B6E",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 5,
  },
  disabledCard: {
    minHeight: 130,
    opacity: 0.78,
    borderColor: StoryBuddyColors.border,
    shadowOpacity: 0,
  },
  modeIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledIcon: { backgroundColor: "#EEE9F3" },
  modeCopy: { flex: 1, marginLeft: Spacing.lg },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  modeTitle: {
    color: StoryBuddyColors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
    marginBottom: Spacing.xs,
  },
  modeDescription: {
    color: StoryBuddyColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  disabledText: { color: "#867995" },
  startPill: {
    alignSelf: "center",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "#7357D9",
  },
  startPillText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  comingSoon: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EEE9F3",
  },
  comingSoonText: {
    color: "#7357D9",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
