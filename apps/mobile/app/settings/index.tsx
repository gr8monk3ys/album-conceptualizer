import { useRouter } from "expo-router";
import {
  ChevronRight,
  CreditCard,
  Info,
  LogOut,
  Mail,
  User as UserIcon,
  Briefcase,
} from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { Avatar, Badge, Button, Card } from "../../src/components/ui";
import { useAuth } from "../../src/hooks/use-auth";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Constants ────────────────────────────────────────────────────────

const APP_VERSION = "1.0.0";

// ── Settings row component ───────────────────────────────────────────

interface SettingsRowProps {
  label: string;
  value?: string;
  icon: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}

function SettingsRow({
  label,
  value,
  icon,
  onPress,
  showChevron = false,
}: SettingsRowProps): ReactNode {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>{icon}</View>
      <View style={styles.settingsRowContent}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {value && (
          <Text style={styles.settingsRowValue} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      {showChevron && (
        <ChevronRight size={18} color={colors.textMuted} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ── Main screen ──────────────────────────────────────────────────────

export default function SettingsScreen(): ReactNode {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in" as never);
        },
      },
    ]);
  }, [signOut, router]);

  const handleNavigateToBilling = useCallback(() => {
    router.push("/settings/billing" as never);
  }, [router]);

  const displayName = user?.name ?? "Unknown User";
  const displayEmail = user?.email ?? "No email";

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View style={styles.profileSection}>
          <Avatar
            uri={user?.image ?? undefined}
            name={displayName}
            size="lg"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{displayEmail}</Text>
          </View>
        </View>

        {/* Account section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card>
            <View style={styles.cardContent}>
              <SettingsRow
                label="Name"
                value={displayName}
                icon={<UserIcon size={18} color={colors.textSecondary} />}
              />
              <View style={styles.divider} />
              <SettingsRow
                label="Email"
                value={displayEmail}
                icon={<Mail size={18} color={colors.textSecondary} />}
              />
            </View>
          </Card>
        </View>

        {/* Workspace section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Workspace</Text>
          <Card>
            <View style={styles.cardContent}>
              <SettingsRow
                label="Workspace"
                value="Personal"
                icon={<Briefcase size={18} color={colors.textSecondary} />}
              />
            </View>
          </Card>
        </View>

        {/* Subscription section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <Card>
            <View style={styles.cardContent}>
              <SettingsRow
                label="Current Plan"
                icon={<CreditCard size={18} color={colors.textSecondary} />}
                onPress={handleNavigateToBilling}
                showChevron
              />
              <View style={styles.planBadgeRow}>
                <Badge text="FREE" variant="info" />
              </View>
            </View>
          </Card>
        </View>

        {/* App section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>App</Text>
          <Card>
            <View style={styles.cardContent}>
              <SettingsRow
                label="Version"
                value={APP_VERSION}
                icon={<Info size={18} color={colors.textSecondary} />}
              />
              <View style={styles.divider} />
              <SettingsRow
                label="About"
                value="Album Conceptualizer"
                icon={<Info size={18} color={colors.textSecondary} />}
              />
            </View>
          </Card>
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="danger"
            icon={<LogOut size={18} color={colors.white} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing["3xl"],
  },

  // Profile
  profileSection: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.md,
  },
  profileInfo: {
    alignItems: "center",
    gap: spacing.xs,
  },
  profileName: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },

  // Sections
  sectionContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingLeft: spacing.xs,
  },
  cardContent: {
    gap: 0,
  },

  // Settings rows
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  settingsRowIcon: {
    width: 32,
    alignItems: "center",
  },
  settingsRowContent: {
    flex: 1,
    gap: 2,
  },
  settingsRowLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  settingsRowValue: {
    color: colors.text,
    fontSize: fontSize.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginLeft: 44,
  },
  planBadgeRow: {
    paddingLeft: 44,
    paddingBottom: spacing.xs,
  },

  // Sign out
  signOutSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["2xl"],
  },
});
