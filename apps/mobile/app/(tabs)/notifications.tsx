import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ListRenderItem } from "react-native";
import type { ReactNode } from "react";

import {
  AnimatedScreen,
  Avatar,
  EmptyState,
  ErrorState,
  Loading,
  LoadingInline,
} from "../../src/components/ui";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "../../src/hooks/use-notifications";
import type { Notification } from "../../src/api/types";
import { colors, fontSize, spacing } from "../../src/theme";

// ── Helpers ─────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Notification Row ────────────────────────────────────────────────

interface NotificationRowProps {
  notification: Notification;
  onPress: () => void;
}

function NotificationRow({
  notification,
  onPress,
}: NotificationRowProps): ReactNode {
  const isUnread = notification.readAt === null;
  const actorName = notification.actor?.name ?? "System";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationRow,
        isUnread && styles.unreadRow,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Avatar
        uri={notification.actor?.image ?? undefined}
        name={actorName}
        size="sm"
      />

      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle} numberOfLines={2}>
          {notification.title}
        </Text>
        {notification.body && (
          <Text style={styles.notificationBody} numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text style={styles.notificationTime}>
          {timeAgo(notification.createdAt)}
        </Text>
      </View>

      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export default function NotificationsScreen(): ReactNode {
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  const handlePress = useCallback(
    (notification: Notification) => {
      if (notification.readAt === null) {
        markRead.mutate(notification.id);
      }
      if (notification.url) {
        router.push(notification.url as never);
      }
    },
    [markRead, router],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem: ListRenderItem<Notification> = useCallback(
    ({ item }) => (
      <NotificationRow
        notification={item}
        onPress={() => handlePress(item)}
      />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <AnimatedScreen>
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <Pressable
            onPress={() => markAllRead.mutate()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isFetchingNextPage ? <LoadingInline /> : null}
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="All caught up!"
            description="You have no notifications. We'll let you know when something happens."
          />
        }
      />
    </SafeAreaView>
    </AnimatedScreen>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  screenTitle: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  markAllText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: spacing["3xl"],
  },
  emptyContainer: {
    flex: 1,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    gap: spacing.md,
  },
  unreadRow: {
    backgroundColor: "rgba(99,102,241,0.06)",
  },
  notificationContent: {
    flex: 1,
    gap: spacing.xs,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
    lineHeight: 20,
  },
  notificationBody: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  notificationTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
});
