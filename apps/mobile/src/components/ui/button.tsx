import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { hapticLight } from "../../utils/haptics";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

const VARIANT_STYLES: Record<
  ButtonVariant,
  { bg: string; text: string; border?: string }
> = {
  primary: { bg: colors.primary, text: colors.white },
  secondary: {
    bg: colors.surfaceElevated,
    text: colors.text,
    border: colors.surfaceBorder,
  },
  ghost: { bg: colors.transparent, text: colors.textSecondary },
  danger: { bg: colors.error, text: colors.white },
};

const SIZE_STYLES: Record<
  ButtonSize,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number }
> = {
  sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
  },
  md: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.lg,
  },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
}: ButtonProps): ReactNode {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: variantStyle.bg,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          borderColor: variantStyle.border ?? colors.transparent,
          borderWidth: variantStyle.border ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { color: variantStyle.text, fontSize: sizeStyle.fontSize },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontWeight: "600",
  },
});
