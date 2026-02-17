import { Stack, useLocalSearchParams, useRouter, useSegments } from "expo-router";
import {
  AlertTriangle,
  BookOpen,
  Download,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Music,
  Network,
} from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Layout } from "react-native-reanimated";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";

import { ErrorBoundary, Loading } from "../../../src/components/ui";
import { hapticSelection } from "../../../src/utils/haptics";
import { useAlbum } from "../../../src/hooks/use-albums";
import { borderRadius, colors, fontSize, spacing } from "../../../src/theme";

// ── Tab definitions ──────────────────────────────────────────────────

interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  route: string;
}

const TABS: TabDef[] = [
  { key: "index", label: "Overview", icon: LayoutDashboard, route: "" },
  { key: "studio", label: "Studio", icon: Music, route: "/studio" },
  { key: "bible", label: "Bible", icon: BookOpen, route: "/bible" },
  { key: "coherence", label: "Coherence", icon: Network, route: "/coherence" },
  { key: "export", label: "Export", icon: Download, route: "/export" },
  { key: "versions", label: "Versions", icon: GitBranch, route: "/versions" },
  { key: "inbox", label: "Inbox", icon: Inbox, route: "/inbox" },
];

// ── Tab bar item ─────────────────────────────────────────────────────

interface TabItemProps {
  tab: TabDef;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ tab, isActive, onPress }: TabItemProps): ReactNode {
  const Icon = tab.icon;
  const color = isActive ? colors.primary : colors.textMuted;

  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.tab,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon size={18} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
      {isActive && (
        <Animated.View layout={Layout.springify()} style={styles.tabIndicator} />
      )}
    </Pressable>
  );
}

// ── Layout ───────────────────────────────────────────────────────────

export default function AlbumWorkspaceLayout(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const segments = useSegments();
  const { data: album, isLoading } = useAlbum(albumId);

  const activeSegment = segments[segments.length - 1] ?? "index";
  const activeKey = activeSegment === "[albumId]" ? "index" : activeSegment;

  const handleTabPress = useCallback(
    (tab: TabDef) => {
      const path = `/album/${albumId}${tab.route}`;
      router.replace(path as never);
    },
    [albumId, router],
  );

  if (!albumId || isLoading) {
    return <Loading />;
  }

  const headerTitle = album?.title ?? "Album";

  return (
    <View style={styles.root}>
      <ErrorBoundary
        fallback={(error, resetError) => (
          <View style={styles.errorContainer}>
            <AlertTriangle size={48} color={colors.warning} />
            <Text style={styles.errorTitle}>Album Error</Text>
            <Text style={styles.errorMessage} numberOfLines={3}>
              {error.message || "Something went wrong loading this album."}
            </Text>
            <View style={styles.errorActions}>
              <Pressable style={styles.errorButton} onPress={resetError}>
                <Text style={styles.errorButtonText}>Try Again</Text>
              </Pressable>
              <Pressable
                style={[styles.errorButton, styles.errorButtonSecondary]}
                onPress={() => router.back()}
              >
                <Text style={styles.errorButtonTextSecondary}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        )}
      >
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: colors.background },
            animation: "fade",
          }}
        >
          <Stack.Screen
            name="index"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="studio"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="bible"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="coherence"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="export"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="versions"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="inbox"
            options={{ title: headerTitle, headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="collab/index"
            options={{ title: "Collab Rooms", headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="collab/[roomId]"
            options={{ title: "Collab Room", headerBackTitle: "Back" }}
          />
        </Stack>

        <View style={styles.tabBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((tab) => (
              <TabItem
                key={tab.key}
                tab={tab}
                isActive={activeKey === tab.key}
                onPress={() => handleTabPress(tab)}
              />
            ))}
          </ScrollView>
        </View>
      </ErrorBoundary>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBarContainer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tab: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    position: "relative",
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  errorTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
    textAlign: "center",
  },
  errorMessage: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  errorButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  errorButtonSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  errorButtonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: fontSize.base,
  },
  errorButtonTextSecondary: {
    color: colors.text,
    fontWeight: "600",
    fontSize: fontSize.base,
  },
});
