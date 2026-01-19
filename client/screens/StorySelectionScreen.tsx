import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, StoryBuddyColors } from "@/constants/theme";
import { STORIES, Story } from "@/constants/stories";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface StoryCardProps {
  story: Story;
  index: number;
  onPress: () => void;
}

function StoryCard({ story, index, onPress }: StoryCardProps) {
  const scale = useSharedValue(1);

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
          <ThemedText style={styles.storyTitle}>{story.title}</ThemedText>
          <ThemedText style={styles.storyDescription}>
            {story.description}
          </ThemedText>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function StorySelectionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSelectStory = (story: Story) => {
    navigation.navigate("Session", { story });
  };

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
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
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
