import Animated, { FadeIn } from "react-native-reanimated";
import { StyleSheet } from "react-native";
import type { ReactNode } from "react";

import { colors } from "../../theme";

interface AnimatedScreenProps {
  children: ReactNode;
}

export function AnimatedScreen({ children }: AnimatedScreenProps): ReactNode {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
