import React, { useEffect } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  FredokaOne_400Regular,
} from "@expo-google-fonts/fredoka-one";
import { Feather } from "@expo/vector-icons";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { ProgressProvider } from "@/context/ProgressContext";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { width } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts({
    FredokaOne_400Regular,
    ...Feather.font,
  });
  const useDesktopShell = Platform.OS === "web" && width >= 768;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <SubscriptionProvider>
            <ProgressProvider>
              <SafeAreaProvider>
                <View
                  testID="app-viewport"
                  style={[
                    styles.viewport,
                    useDesktopShell && styles.desktopViewport,
                  ]}
                >
                  <GestureHandlerRootView
                    testID="app-shell"
                    style={[
                      styles.root,
                      useDesktopShell && styles.desktopShell,
                    ]}
                  >
                    <KeyboardProvider>
                      <NavigationContainer>
                        <RootStackNavigator />
                      </NavigationContainer>
                      <StatusBar style="dark" />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </View>
              </SafeAreaProvider>
            </ProgressProvider>
          </SubscriptionProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  desktopViewport: {
    alignItems: "center",
    backgroundColor: "#DDEBFA",
    paddingVertical: 16,
  },
  desktopShell: {
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    backgroundColor: "#F8F5FF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(47, 76, 112, 0.12)",
    shadowColor: "#173A68",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
});
