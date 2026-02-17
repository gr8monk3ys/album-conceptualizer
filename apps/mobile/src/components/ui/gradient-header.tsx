import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { colors, fontSize, spacing } from "../../theme";

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function GradientHeader({
  title,
  subtitle,
  children,
}: GradientHeaderProps): ReactNode {
  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.background]}
      style={styles.gradient}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingTop: spacing.xl,
    paddingBottom: spacing["2xl"],
    paddingHorizontal: spacing.lg,
  },
  content: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: fontSize["3xl"],
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
});
