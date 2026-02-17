import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { ReactNode } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";

import { borderRadius, colors } from "../../theme";

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  borderRadiusValue?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width,
  height,
  borderRadiusValue = borderRadius.md,
  style,
}: SkeletonProps): ReactNode {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: borderRadiusValue },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceElevated,
  },
});
