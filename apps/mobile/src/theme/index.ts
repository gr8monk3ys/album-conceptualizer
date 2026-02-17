/** Design tokens for Album Conceptualizer mobile app. */

export const colors = {
  // Brand
  primary: "#6366f1", // indigo-500
  primaryLight: "#818cf8", // indigo-400
  primaryDark: "#4f46e5", // indigo-600

  // Backgrounds
  background: "#0a0a0a",
  surface: "#171717",
  surfaceElevated: "#262626",
  surfaceBorder: "#404040",

  // Text
  text: "#fafafa",
  textSecondary: "#a3a3a3",
  textMuted: "#737373",

  // Semantic
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",

  // Misc
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
