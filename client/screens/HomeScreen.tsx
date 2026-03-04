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
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StoryBuddyColors } from "@/constants/theme";
import { BUILD_DATE } from "@/constants/buildDate";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const buttonScale = useSharedValue(1);
  const mascotFloat = useSharedValue(0);
  const sparkleOpacity = useSharedValue(0);

  React.useEffect(() => {
    mascotFloat.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    sparkleOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 })
        ),
        -1,
        true
      )
    );
  }, []);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mascotFloat.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15 });
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("StorySelection");
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
            paddingTop: insets.top + Spacing["6xl"],
            paddingBottom: insets.bottom + Spacing["6xl"],
          },
        ]}
      >
        <Animated.View style={[styles.mascotContainer, mascotStyle]}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.mascot}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>StoryLingo</ThemedText>
          <ThemedText style={styles.subtitle}>
            Learn languages through magical stories
          </ThemedText>
        </View>

        <AnimatedPressable
          onPress={handleStart}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.startButton, buttonStyle]}
          testID="button-start"
        >
          <LinearGradient
            colors={[StoryBuddyColors.primary, "#FF8FB3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <ThemedText style={styles.buttonText}>Start</ThemedText>
          </LinearGradient>
        </AnimatedPressable>

        <ThemedText style={styles.buildTimestamp}>
          Build: {BUILD_DATE}
        </ThemedText>
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
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  mascotContainer: {
    marginBottom: Spacing["3xl"],
  },
  mascot: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius["2xl"],
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: Spacing["5xl"],
  },
  title: {
    fontSize: 40,
    fontWeight: "700",
    color: StoryBuddyColors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
  },
  startButton: {
    width: 200,
    height: 70,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buildTimestamp: {
    fontSize: 12,
    color: StoryBuddyColors.textSecondary,
    marginTop: Spacing["3xl"],
    opacity: 0.6,
  },
});
