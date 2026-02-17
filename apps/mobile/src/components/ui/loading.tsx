import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { colors } from "../../theme";

export function Loading(): ReactNode {
  return (
    <View style={styles.fullScreen}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function LoadingInline(): ReactNode {
  return (
    <View style={styles.inline}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  inline: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
