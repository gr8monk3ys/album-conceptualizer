import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { colors, fontSize, spacing } from "../../theme";

interface SectionHeaderAction {
  title: string;
  onPress: () => void;
}

interface SectionHeaderProps {
  title: string;
  action?: SectionHeaderAction;
}

export function SectionHeader({
  title,
  action,
}: SectionHeaderProps): ReactNode {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={styles.actionText}>{action.title}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  actionText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
