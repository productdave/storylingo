import { Platform } from "react-native";

export const StoryBuddyColors = {
  primary: "#FF6B9D",
  secondary: "#FFD93D",
  background: "#F8F5FF",
  surface: "#FFFFFF",
  textPrimary: "#2D1B4E",
  textSecondary: "#7E6BA3",
  success: "#6BCF7F",
  border: "#E5D9F2",
  error: "#FF6B6B",
};

const tintColorLight = StoryBuddyColors.primary;
const tintColorDark = "#FF8FB3";

export const Colors = {
  light: {
    text: StoryBuddyColors.textPrimary,
    buttonText: "#FFFFFF",
    tabIconDefault: StoryBuddyColors.textSecondary,
    tabIconSelected: tintColorLight,
    link: StoryBuddyColors.primary,
    backgroundRoot: StoryBuddyColors.background,
    backgroundDefault: StoryBuddyColors.surface,
    backgroundSecondary: "#F0EBF8",
    backgroundTertiary: "#E5D9F2",
  },
  dark: {
    text: "#F8F5FF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    backgroundRoot: "#1A1025",
    backgroundDefault: "#2D1B4E",
    backgroundSecondary: "#3D2B5E",
    backgroundTertiary: "#4D3B6E",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 60,
  inputHeight: 48,
  buttonHeight: 70,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
