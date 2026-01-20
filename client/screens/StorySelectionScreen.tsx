import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Modal, Text } from "react-native";
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
import { STORIES, Story } from "@/constants/stories";
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconContainer}>
            <Feather name="gift" size={40} color={StoryBuddyColors.primary} />
          </View>
          
          <Text style={styles.modalTitle}>Start Your Free Trial!</Text>
          <Text style={styles.modalSubtitle}>
            Enjoy 7 days of unlimited magical stories for your little ones
          </Text>
          
          <View style={styles.modalFeatures}>
            <View style={styles.modalFeatureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={styles.modalFeatureText}>Unlimited stories</Text>
            </View>
            <View style={styles.modalFeatureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={styles.modalFeatureText}>All story collections</Text>
            </View>
            <View style={styles.modalFeatureRow}>
              <Feather name="check" size={16} color={StoryBuddyColors.success} />
              <Text style={styles.modalFeatureText}>Cancel anytime</Text>
            </View>
          </View>
          
          <Pressable style={styles.modalButton} onPress={onStartTrial}>
            <Text style={styles.modalButtonText}>Start 7-Day Free Trial</Text>
          </Pressable>
          
          <Pressable style={styles.modalDismissButton} onPress={onDismiss}>
            <Text style={styles.modalDismissText}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    hasSeenTrialPrompt, 
    startTrial,
    markTrialPromptSeen,
    isLoading 
  } = useSubscription();
  
  const [showTrialPrompt, setShowTrialPrompt] = useState(false);

  useEffect(() => {
    if (!isLoading && !hasSeenTrialPrompt && status === 'none') {
      const timer = setTimeout(() => {
        setShowTrialPrompt(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasSeenTrialPrompt, status]);

  const handleSelectStory = (story: Story) => {
    if (!hasActiveSubscription) {
      navigation.navigate("Paywall", { fromTrialPrompt: false });
      return;
    }
    navigation.navigate("Session", { story });
  };

  const handleStartTrial = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowTrialPrompt(false);
    await startTrial();
    navigation.navigate("SubscriptionSuccess", { plan: 'trial' });
  };

  const handleDismissTrialPrompt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTrialPrompt(false);
    await markTrialPromptSeen();
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  const selectLanguage = (lang: Language) => {
    if (lang !== language) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLanguage(lang);
    }
  };

  const getTrialStatusText = () => {
    if (status === 'trial') {
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
        {trialStatusText ? (
          <View style={styles.trialBadge}>
            <Feather name="star" size={12} color={StoryBuddyColors.primary} />
            <Text style={styles.trialBadgeText}>{trialStatusText}</Text>
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
      </ScrollView>

      <TrialPromptModal
        visible={showTrialPrompt}
        onStartTrial={handleStartTrial}
        onDismiss={handleDismissTrialPrompt}
      />
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
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 157, 0.15)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: StoryBuddyColors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 107, 157, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
    color: StoryBuddyColors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    ...Typography.body,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalFeatures: {
    alignSelf: "stretch",
    marginBottom: Spacing.xl,
  },
  modalFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  modalFeatureText: {
    ...Typography.body,
    color: StoryBuddyColors.textPrimary,
  },
  modalButton: {
    backgroundColor: StoryBuddyColors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.xl,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  modalDismissButton: {
    padding: Spacing.sm,
  },
  modalDismissText: {
    ...Typography.body,
    color: StoryBuddyColors.textSecondary,
  },
});
