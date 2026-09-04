import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BorderRadius,
  Spacing,
  StoryBuddyColors,
  Typography,
} from "@/constants/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  return (
    <LinearGradient
      colors={["#E8DEFF", "#F8F5FF", "#FFE8F0"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Feather
                  name="file-text"
                  size={20}
                  color={StoryBuddyColors.primary}
                />
              </View>
              <Text style={styles.menuItemText}>Terms of Service</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={StoryBuddyColors.textSecondary}
            />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Feather
                  name="shield"
                  size={20}
                  color={StoryBuddyColors.primary}
                />
              </View>
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={StoryBuddyColors.textSecondary}
            />
          </Pressable>
        </View>

        <Text style={styles.versionText}>StoryLingo v1.0.0</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.small,
    color: StoryBuddyColors.textSecondary,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 157, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuItemText: {
    ...Typography.body,
    color: StoryBuddyColors.textPrimary,
  },
  versionText: {
    ...Typography.small,
    color: StoryBuddyColors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
