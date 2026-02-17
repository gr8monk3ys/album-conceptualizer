import { Image, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { borderRadius, colors, fontSize } from "../../theme";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: AvatarSize;
}

const SIZE_MAP: Record<AvatarSize, { dimension: number; fontSize: number }> = {
  sm: { dimension: 32, fontSize: fontSize.xs },
  md: { dimension: 40, fontSize: fontSize.sm },
  lg: { dimension: 56, fontSize: fontSize.xl },
};

const PALETTE = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

/** Deterministic color from a name string. */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Extract up to two initials from a name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = "md",
}: AvatarProps): ReactNode {
  const sizeConfig = SIZE_MAP[size];
  const dimension = sizeConfig.dimension;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.initialsContainer,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: colorFromName(name),
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: sizeConfig.fontSize }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceElevated,
  },
  initialsContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.white,
    fontWeight: "700",
  },
});
