import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Music } from "lucide-react-native";
import type { ReactNode } from "react";

import { borderRadius, colors } from "../../theme";

interface AlbumCoverProps {
  coverUrl?: string | null;
  size?: number;
}

export function AlbumCover({ coverUrl, size = 48 }: AlbumCoverProps): ReactNode {
  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size * 0.2 },
        ]}
      />
    );
  }

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.surfaceElevated]}
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size * 0.2 },
      ]}
    >
      <Music size={size * 0.4} color={colors.primaryLight} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: "cover",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
