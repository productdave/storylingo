import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Text } from "react-native";
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
import { Spacing, BorderRadius, StoryBuddyColors, Typography } from "@/constants/theme";
import { STORIES, Story, COMING_SOON_STORIES } from "@/constants/stories";
import { useLanguage, getStoryTranslation, Language, TranslationType } from "@/context/LanguageContext";
import { useSubscription } from "@/context/SubscriptionContext";
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
          <ThemedText style={styles.storyTitle}>{storyTranslation.title}</ThemedText>
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const { language, setLanguage, t } = useLanguage();
  const { 
    status, 
    trialDaysRemaining, 
    hasActiveSubscription, 
    isTrialExpired,
    dailyListenTimeSeconds,
    dailyLimitSeconds,
  } = useSubscription();

  const isFreeTrial = status === 'free_trial';
  const isExtendedTrial = status === 'extended_trial';
  const remainingSeconds = Math.max(0, dailyLimitSeconds - dailyListenTimeSeconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const isLowTime = remainingSeconds < 180; // Less than 3 minutes

  const handleSelectStory = (story: Story) => {
    if (isTrialExpired) {
      navigation.navigate("Paywall", { fromTrialPrompt: false });
      return;
    }
    navigation.navigate("Session", { story });
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Paywall", { fromTrialPrompt: false });
  };

  const selectLanguage = (lang: Language) => {
    if (lang !== language) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLanguage(lang);
    }
  };

  const getTrialStatusText = () => {
    if (status === 'free_trial' || status === 'extended_trial') {
      return `Trial: ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left`;
    }
    if (status === 'monthly' || status === 'annual') {
      return 'Premium';
    }
    return null;
  };

  const trialStatusText = getTrialStatusText();

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.headerRow, { paddingTop: headerHeight + Spacing.md }]}>
        {isFreeTrial ? (
          <Pressable style={[styles.trialBadgeContainer, isLowTime ? styles.trialBadgeWarning : null]} onPress={handleUpgrade}>
            <View style={styles.trialBadgeRow}>
              <Feather 
                name="clock" 
                size={12} 
                color={isLowTime ? StoryBuddyColors.error : StoryBuddyColors.primary} 
              />
              <Text style={[styles.trialBadgeText, isLowTime ? styles.trialBadgeTextWarning : null]}>
                {remainingMinutes} min left
              </Text>
            </View>
            <Text style={styles.trialDaysText}>{trialDaysRemaining}-day trial</Text>
          </Pressable>
        ) : isExtendedTrial ? (
          <View style={styles.extendedTrialBadge}>
            <Feather name="gift" size={12} color="#6A5ACD" />
            <Text style={styles.extendedTrialText}>{trialDaysRemaining} days left</Text>
          </View>
        ) : hasActiveSubscription ? (
          <View style={styles.premiumBadge}>
            <Feather name="award" size={12} color={StoryBuddyColors.success} />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        ) : (
          <View style={styles.trialBadgePlaceholder} />
        )}
        
        <View style={styles.languageToggle} testID="button-language-toggle">
          <Pressable
            style={[styles.languageOption, language === "en" ? styles.languageOptionActive : null]}
            onPress={() => selectLanguage("en")}
          >
            <ThemedText style={[styles.languageText, language === "en" ? styles.languageTextActive : null]}>
              EN
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.languageOption, language === "zh" ? styles.languageOptionActive : null]}
            onPress={() => selectLanguage("zh")}
          >
            <ThemedText style={[styles.languageText, language === "zh" ? styles.languageTextActive : null]}>
              中文
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.languageOption, language === "es" ? styles.languageOptionActive : null]}
            onPress={() => selectLanguage("es")}
          >
            <ThemedText style={[styles.languageText, language === "es" ? styles.languageTextActive : null]}>
              ES
            </ThemedText>
          </Pressable>
        </View>
        
        <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
          <Feather name="settings" size={22} color={StoryBuddyColors.textSecondary} />
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
              <Feather name="book-open" size={24} color={StoryBuddyColors.secondary} />
            </View>
            <View style={styles.comingSoonTextContainer}>
              <ThemedText style={styles.featureComingSoonTitle}>{t.vocabularyPractice.title}</ThemedText>
              <ThemedText style={styles.comingSoonDescription}>{t.vocabularyPractice.description}</ThemedText>
            </View>
            <View style={styles.comingSoonBadge}>
              <ThemedText style={styles.comingSoonBadgeText}>{t.comingSoon}</ThemedText>
            </View>
          </View>
          
          {COMING_SOON_STORIES.map((story) => {
            const storyTranslation = getStoryTranslation(t, story.id);
            return (
              <View key={story.id} style={styles.comingSoonCard}>
                <View style={styles.comingSoonIconContainer}>
                  <Feather name="lock" size={20} color={StoryBuddyColors.textSecondary} />
                </View>
                <View style={styles.comingSoonTextContainer}>
                  <ThemedText style={styles.comingSoonStoryTitle}>{storyTranslation.title}</ThemedText>
                  <ThemedText style={styles.comingSoonDescription}>{storyTranslation.description}</ThemedText>
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
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: StoryBuddyColors.success,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  trialBadgeContainer: {
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 157, 0.15)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  trialBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: StoryBuddyColors.primary,
  },
  trialDaysText: {
    fontSize: 10,
    color: StoryBuddyColors.textSecondary,
    marginTop: 2,
  },
  extendedTrialBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(106, 90, 205, 0.15)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  extendedTrialText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6A5ACD",
  },
  trialBadgeWarning: {
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  trialBadgeTextWarning: {
    color: StoryBuddyColors.error,
  },
  trialBadgePlaceholder: {
    width: 80,
  },
  settingsButton: {
    padding: Spacing.xs,
  },
  languageToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 2,
    borderColor: StoryBuddyColors.border,
  },
  languageOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  languageOptionActive: {
    backgroundColor: StoryBuddyColors.primary,
  },
  languageText: {
    fontSize: 14,
    fontWeight: "600",
    color: StoryBuddyColors.textSecondary,
  },
  languageTextActive: {
    color: "#FFFFFF",
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
