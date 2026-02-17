/** Notification hooks — React Query wrappers with cursor pagination. */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { notificationsApi } from "../api/notifications";
import type { NotificationList } from "../api/types";

const NOTIFICATIONS_KEY = ["notifications"] as const;

// ── Queries ──────────────────────────────────────────────────────────

export function useNotifications(unread?: boolean) {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, { unread }],
    queryFn: ({ pageParam }) =>
      notificationsApi.list({ unread, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: NotificationList) => lastPage.nextCursor,
  });
}

/**
 * Derives the unread count from the first page of the notifications query.
 * Returns 0 while loading.
 */
export function useUnreadCount(): number {
  const { data } = useNotifications(true);
  return data?.pages[0]?.unreadCount ?? 0;
}

// ── Mutations ────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
