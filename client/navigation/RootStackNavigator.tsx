import React from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import HomeScreen from "@/screens/HomeScreen";
import StorySelectionScreen from "@/screens/StorySelectionScreen";
import SessionScreen from "@/screens/SessionScreen";
import ConversationReviewScreen from "@/screens/ConversationReviewScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ThinkGuessModeScreen from "@/screens/ThinkGuessModeScreen";
import ThinkGuessGameScreen from "@/screens/ThinkGuessGameScreen";
import type { Story } from "@/constants/stories";
import type { ConversationMessage } from "@/context/ProgressContext";
import { Spacing, StoryBuddyColors } from "@/constants/theme";

export type RootStackParamList = {
  Home: undefined;
  StorySelection: undefined;
  Session: { story: Story };
  ConversationReview: { story: Story; transcript: ConversationMessage[] };
  Settings: undefined;
  ThinkGuessMode: undefined;
  ThinkGuessGame: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderBackButton({
  label,
  color = StoryBuddyColors.textPrimary,
  onPress,
}: {
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, back`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerBackButton,
        pressed && styles.headerBackButtonPressed,
      ]}
    >
      <Feather name="arrow-left" size={23} color={color} />
    </Pressable>
  );
}

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StorySelection"
        component={StorySelectionScreen}
        options={({ navigation }) => ({
          headerTitle: "Choose Your Story",
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackButton
              label="Home"
              onPress={() => navigation.goBack()}
            />
          ),
        })}
      />
      <Stack.Screen
        name="ThinkGuessMode"
        component={ThinkGuessModeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ThinkGuessGame"
        component={ThinkGuessGameScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={({ navigation, route }) => ({
          headerTitle: route.params.story.title,
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackButton
              color="#FFFFFF"
              label="Choose Your Story"
              onPress={() => navigation.goBack()}
            />
          ),
          headerTintColor: "#FFFFFF",
          headerStyle: { backgroundColor: "transparent" },
          headerTransparent: true,
          contentStyle: { backgroundColor: "#2D1B4E" },
        })}
      />
      <Stack.Screen
        name="ConversationReview"
        component={ConversationReviewScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={({ navigation }) => ({
          headerTitle: "Settings",
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackButton
              label="Choose Your Story"
              onPress={() => navigation.goBack()}
            />
          ),
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerBackButton: {
    width: 44,
    height: 44,
    marginLeft: Platform.select({ web: Spacing.lg, default: 0 }),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerBackButtonPressed: {
    backgroundColor: "rgba(126,107,163,0.12)",
    transform: [{ scale: 0.95 }],
  },
});
