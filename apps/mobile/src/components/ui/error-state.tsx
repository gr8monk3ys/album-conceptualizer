import { AlertCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { Button } from "./button";
import { borderRadius, colors, fontSize, spacing } from "../../theme";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps): ReactNode {
  return (
    <View style={styles.container}>
      <AlertCircle size={48} color={colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Retry" onPress={onRetry} variant="secondary" size="sm" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: "center",
    lineHeight: 22,
  },
});
