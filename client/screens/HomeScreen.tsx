import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StoryBuddyColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useLanguage } from "@/context/LanguageContext";
import { useProgress } from "@/context/ProgressContext";
import { emitThinkGuessEvent } from "@/lib/think-guess";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ActivityCard({
  title,
  description,
  icon,
  colors,
  onPress,
  testID,
}: {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  colors: [string, string];
  onPress: () => void;
  testID: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[styles.activityCard, animatedStyle]}
      testID={testID}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.activityIcon}
      >
        <Feather name={icon} size={28} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.activityCopy}>
        <ThemedText style={styles.activityTitle}>{title}</ThemedText>
        <ThemedText style={styles.activityDescription}>
          {description}
        </ThemedText>
      </View>
      <Feather
        name="chevron-right"
        size={24}
        color={StoryBuddyColors.textSecondary}
      />
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, t } = useLanguage();
  const { getThinkGuessProgress } = useProgress();

  const handleStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("StorySelection");
  };

  const handleThinkGuess = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const progress = getThinkGuessProgress();
    void emitThinkGuessEvent({
      event: "think_guess_entry_tapped",
      language,
      languageLevel: progress.languageLevel,
      reasoningLevel: progress.reasoningLevel,
      timestamp: Date.now(),
    });
    navigation.navigate("ThinkGuessMode");
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/storylingo-adventure-map-v1.png")}
        style={styles.mapBackground}
        resizeMode="cover"
        testID="home-adventure-map"
      />
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0.02)",
          "rgba(255, 248, 225, 0.08)",
          "rgba(255, 244, 218, 0.98)",
        ]}
        locations={[0, 0.48, 0.76]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.overlay}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.spacer} />

          <View style={styles.welcomePanel}>
            <View style={styles.logoMedallion}>
              <Image
                source={require("../../assets/images/icon.png")}
                style={styles.logoImage}
                resizeMode="cover"
                testID="home-logo"
              />
            </View>

            <ThemedText style={styles.eyebrow}>
              CHOOSE YOUR ADVENTURE
            </ThemedText>
            <ThemedText style={styles.title}>StoryLingo</ThemedText>

            <ThemedText style={styles.subtitle}>
              Learn languages through magical stories and speaking games
            </ThemedText>

            <View style={styles.activities}>
              <ActivityCard
                title={t.thinkGuess.storyTitle}
                description={t.thinkGuess.storyDescription}
                icon="book-open"
                colors={[StoryBuddyColors.primary, "#FF8A7A"]}
                onPress={handleStart}
                testID="button-start"
              />
              <ActivityCard
                title={t.thinkGuess.homeTitle}
                description={t.thinkGuess.homeDescription}
                icon="help-circle"
                colors={["#7357D9", "#9C7BFF"]}
                onPress={handleThinkGuess}
                testID="card-think-guess"
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF1CE",
  },
  mapBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    aspectRatio: 2 / 3,
  },
  overlay: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  spacer: {
    flex: 1,
    minHeight: 150,
  },
  welcomePanel: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    paddingTop: 62,
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
    borderRadius: 32,
    backgroundColor: "rgba(255, 252, 243, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(92, 71, 120, 0.12)",
    shadowColor: "#4D3B6E",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  logoMedallion: {
    position: "absolute",
    top: -66,
    width: 112,
    height: 112,
    overflow: "hidden",
    borderRadius: 56,
    backgroundColor: "#E8D9F0",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  eyebrow: {
    marginBottom: Spacing.xs,
    color: "#8B72A8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  title: {
    fontFamily: "FredokaOne_400Regular",
    fontSize: 42,
    color: StoryBuddyColors.textPrimary,
    lineHeight: 50,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 290,
    marginBottom: Spacing.xl,
    fontSize: 16,
    lineHeight: 23,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
  },
  activities: {
    width: "100%",
    gap: Spacing.md,
  },
  activityCard: {
    width: "100%",
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(92, 71, 120, 0.12)",
    shadowColor: "#4D3B6E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  activityIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  activityTitle: {
    color: StoryBuddyColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  activityDescription: {
    color: StoryBuddyColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
