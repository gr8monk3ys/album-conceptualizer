import { Award, Music, Package, Zap } from "lucide-react-native";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";

import { Card } from "../../src/components/ui";
import { borderRadius, colors, fontSize, spacing } from "../../src/theme";

// ── Feature Card ────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
}

function FeatureCard({
  icon: Icon,
  iconColor,
  title,
  description,
  onPress,
}: FeatureCardProps): ReactNode {
  return (
    <Card style={styles.featureCard} onPress={onPress}>
      <View style={styles.featureIconContainer}>
        <Icon size={24} color={iconColor} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </Card>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

function showComingSoon(feature: string): void {
  Alert.alert("Coming Soon", `${feature} is coming in a future update.`);
}

export default function StudioScreen(): ReactNode {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Studio</Text>
          <Text style={styles.subtitle}>
            Creative tools for your music projects
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <FeatureCard
            icon={Zap}
            iconColor={colors.warning}
            title="Jam Mode"
            description="Real-time collaborative songwriting with AI assistance."
            onPress={() => showComingSoon("Jam Mode")}
          />

          <FeatureCard
            icon={Award}
            iconColor={colors.primary}
            title="Challenges"
            description="Weekly songwriting challenges to spark your creativity."
            onPress={() => showComingSoon("Challenges")}
          />

          <FeatureCard
            icon={Package}
            iconColor={colors.success}
            title="Prompt Packs"
            description="Curated prompt collections for different genres and moods."
            onPress={() => showComingSoon("Prompt Packs")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing["3xl"],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  screenTitle: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  cardsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: spacing.xs,
  },
  featureTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  featureDescription: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
