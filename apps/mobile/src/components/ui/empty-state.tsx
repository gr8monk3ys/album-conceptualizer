import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";

import { colors, fontSize, spacing } from "../../theme";
import { Button } from "./button";

interface EmptyStateAction {
  title: string;
  onPress: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps): ReactNode {
  return (
    <View style={styles.container}>
      <Icon size={48} color={colors.textMuted} strokeWidth={1.5} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <View style={styles.action}>
          <Button title={action.title} onPress={action.onPress} size="sm" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.lg,
  },
});
