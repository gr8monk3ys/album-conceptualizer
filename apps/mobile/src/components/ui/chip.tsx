import { Pressable, StyleSheet, Text } from "react-native";
import type { ReactNode } from "react";

import { borderRadius, colors, fontSize, spacing } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({
  label,
  selected = false,
  onPress,
}: ChipProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        { opacity: pressed && onPress ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  selected: {
    backgroundColor: colors.primary,
  },
  unselected: {
    backgroundColor: colors.surfaceElevated,
  },
  text: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  textSelected: {
    color: colors.white,
  },
});
