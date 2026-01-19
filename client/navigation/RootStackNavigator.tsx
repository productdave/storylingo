import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import HomeScreen from "@/screens/HomeScreen";
import StorySelectionScreen from "@/screens/StorySelectionScreen";
import SessionScreen from "@/screens/SessionScreen";
import type { Story } from "@/constants/stories";
import type { Language } from "@/constants/translations";

export type RootStackParamList = {
  Home: undefined;
  StorySelection: undefined;
  Session: { story: Story; language: Language };
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
        })}
      />
    </Stack.Navigator>
  );
}
