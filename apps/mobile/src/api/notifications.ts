/** Notifications API — inbox, read tracking, and cursor pagination. */
import { api } from "./client";
import type { NotificationList } from "./types";

export interface NotificationListParams {
  unread?: boolean;
  limit?: number;
  cursor?: string;
}

function buildQuery(params?: NotificationListParams): string {
  if (!params) return "";

  const entries: string[] = [];
  if (params.unread !== undefined) entries.push(`unread=${params.unread}`);
  if (params.limit !== undefined) entries.push(`limit=${params.limit}`);
  if (params.cursor) entries.push(`cursor=${params.cursor}`);

  return entries.length > 0 ? `?${entries.join("&")}` : "";
}

export const notificationsApi = {
  list: (params?: NotificationListParams) =>
    api.get<NotificationList>(`/api/notifications${buildQuery(params)}`),

  markRead: (id: string) =>
    api.patch(`/api/notifications/${id}`, { read: true }),

  markAllRead: () => api.post("/api/notifications/read-all"),
};
