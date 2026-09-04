import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Spacing,
  BorderRadius,
  StoryBuddyColors,
  Typography,
} from "@/constants/theme";
import { STORIES, Story, COMING_SOON_STORIES } from "@/constants/stories";
import {
  useLanguage,
  getStoryTranslation,
  TranslationType,
} from "@/context/LanguageContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface StoryCardProps {
  story: Story;
  index: number;
  onPress: () => void;
  t: TranslationType;
}

function StoryCard({ story, index, onPress, t }: StoryCardProps) {
  const scale = useSharedValue(1);
  const storyTranslation = getStoryTranslation(t, story.id);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.storyCard, animatedStyle]}
        testID={`card-story-${story.id}`}
      >
        <Image source={story.image} style={styles.storyImage} />
        <LinearGradient
          colors={["transparent", "rgba(45, 27, 78, 0.8)"]}
          style={styles.storyOverlay}
        >
          <ThemedText style={styles.storyTitle}>
            {storyTranslation.title}
          </ThemedText>
          <ThemedText style={styles.storyDescription}>
            {storyTranslation.description}
          </ThemedText>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function StorySelectionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { t } = useLanguage();

  const handleSelectStory = (story: Story) => {
    navigation.navigate("Session", { story });
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View
        style={[styles.headerRow, { paddingTop: headerHeight + Spacing.md }]}
      >
        <View style={styles.headerSide} />

        <LanguageSwitcher />

        <Pressable
          style={styles.settingsButton}
          onPress={handleOpenSettings}
          testID="button-settings"
        >
          <Feather
            name="settings"
            size={22}
            color={StoryBuddyColors.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {STORIES.map((story, index) => (
          <StoryCard
            key={story.id}
            story={story}
            index={index}
            onPress={() => handleSelectStory(story)}
            t={t}
          />
        ))}

        <View style={styles.comingSoonSection}>
          <ThemedText style={styles.comingSoonTitle}>{t.comingSoon}</ThemedText>

          <View style={styles.featureComingSoonCard}>
            <View style={styles.featureComingSoonIconContainer}>
              <Feather
                name="book-open"
                size={24}
                color={StoryBuddyColors.secondary}
              />
            </View>
            <View style={styles.comingSoonTextContainer}>
              <ThemedText style={styles.featureComingSoonTitle}>
                {t.vocabularyPractice.title}
              </ThemedText>
              <ThemedText style={styles.comingSoonDescription}>
                {t.vocabularyPractice.description}
              </ThemedText>
            </View>
            <View style={styles.comingSoonBadge}>
              <ThemedText style={styles.comingSoonBadgeText}>
                {t.comingSoon}
              </ThemedText>
            </View>
          </View>

          {COMING_SOON_STORIES.map((story) => {
            const storyTranslation = getStoryTranslation(t, story.id);
            return (
              <View key={story.id} style={styles.comingSoonCard}>
                <View style={styles.comingSoonIconContainer}>
                  <Feather
                    name="lock"
                    size={20}
                    color={StoryBuddyColors.textSecondary}
                  />
                </View>
                <View style={styles.comingSoonTextContainer}>
                  <ThemedText style={styles.comingSoonStoryTitle}>
                    {storyTranslation.title}
                  </ThemedText>
                  <ThemedText style={styles.comingSoonDescription}>
                    {storyTranslation.description}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerSide: {
    width: 44,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing["2xl"],
  },
  storyCard: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: StoryBuddyColors.surface,
    shadowColor: StoryBuddyColors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  storyImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  storyOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingTop: Spacing["3xl"],
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  storyDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  comingSoonSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.08)",
  },
  comingSoonTitle: {
    ...Typography.h4,
    color: StoryBuddyColors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  comingSoonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderStyle: "dashed",
  },
  comingSoonIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  comingSoonTextContainer: {
    flex: 1,
  },
  comingSoonStoryTitle: {
    ...Typography.body,
    fontWeight: "600",
    color: StoryBuddyColors.textSecondary,
    marginBottom: 2,
  },
  comingSoonDescription: {
    ...Typography.small,
    color: StoryBuddyColors.textSecondary,
    opacity: 0.8,
  },
  featureComingSoonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 217, 61, 0.15)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 217, 61, 0.3)",
  },
  featureComingSoonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 217, 61, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureComingSoonTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: StoryBuddyColors.textPrimary,
    marginBottom: 2,
  },
  comingSoonBadge: {
    backgroundColor: StoryBuddyColors.secondary,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  comingSoonBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: StoryBuddyColors.textPrimary,
  },
});
