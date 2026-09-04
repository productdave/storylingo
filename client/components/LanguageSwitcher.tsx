import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useLanguage, type Language } from "@/context/LanguageContext";
import { BorderRadius, Spacing, StoryBuddyColors } from "@/constants/theme";

const options: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
  { value: "es", label: "ES" },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.container} testID="think-guess-language-switcher">
      {options.map((option) => {
        const active = language === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void setLanguage(option.value);
            }}
            style={[styles.option, active && styles.optionActive]}
            testID={`language-${option.value}`}
          >
            <ThemedText style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: StoryBuddyColors.border,
  },
  option: {
    minWidth: 48,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  optionActive: { backgroundColor: StoryBuddyColors.primary },
  label: {
    color: StoryBuddyColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  labelActive: { color: "#FFFFFF" },
});
