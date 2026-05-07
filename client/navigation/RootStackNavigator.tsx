import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import HomeScreen from "@/screens/HomeScreen";
import StorySelectionScreen from "@/screens/StorySelectionScreen";
import SessionScreen from "@/screens/SessionScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import SubscriptionSuccessScreen from "@/screens/SubscriptionSuccessScreen";
import ConversationReviewScreen from "@/screens/ConversationReviewScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import type { Story } from "@/constants/stories";
import type { ConversationMessage } from "@/context/ProgressContext";

export type RootStackParamList = {
  Home: undefined;
  StorySelection: undefined;
  Session: { story: Story };
  ConversationReview: { story: Story; transcript: ConversationMessage[] };
  Paywall: { fromTrialPrompt?: boolean; fromDailyLimit?: boolean };
  SubscriptionSuccess: { plan: 'trial' | 'monthly' | 'annual' };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
        options={{
          headerTitle: "Choose Your Story",
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={({ route }) => ({
          headerTitle: route.params.story.title,
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
        name="Paywall"
        component={PaywallScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="SubscriptionSuccess"
        component={SubscriptionSuccessScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
        }}
      />
    </Stack.Navigator>
  );
}
