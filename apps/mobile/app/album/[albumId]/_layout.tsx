import { Stack, useLocalSearchParams, useRouter, useSegments } from "expo-router";
import {
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
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";

import { Loading } from "../../../src/components/ui";
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon size={18} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
      {isActive && <View style={styles.tabIndicator} />}
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

  if (isLoading) {
    return <Loading />;
  }

  const headerTitle = album?.title ?? "Album";

  return (
    <View style={styles.root}>
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
});
