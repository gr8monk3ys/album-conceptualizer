import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { borderRadius, colors, fontSize, spacing } from "../../theme";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.surfaceElevated, text: colors.textSecondary },
  success: { bg: "rgba(34,197,94,0.15)", text: colors.success },
  warning: { bg: "rgba(245,158,11,0.15)", text: colors.warning },
  error: { bg: "rgba(239,68,68,0.15)", text: colors.error },
  info: { bg: "rgba(59,130,246,0.15)", text: colors.info },
};

export function Badge({
  text,
  variant = "default",
}: BadgeProps): ReactNode {
  const colorSet = VARIANT_COLORS[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colorSet.bg }]}>
      <Text style={[styles.text, { color: colorSet.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
