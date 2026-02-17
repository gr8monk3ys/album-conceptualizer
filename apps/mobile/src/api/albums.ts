/** Albums API — CRUD, collaboration, and versioning endpoints. */
import { api } from "./client";
import type {
  Album,
  AlbumTask,
  AlbumVersion,
  CreateAlbumInput,
  CreateCommentInput,
  CreateTaskInput,
  SectionComment,
} from "./types";

export const albumsApi = {
  // ── CRUD ─────────────────────────────────────────────────────────────
  list: () => api.get<Album[]>("/api/albums"),
  get: (id: string) => api.get<Album>(`/api/albums/${id}`),
  create: (data: CreateAlbumInput) => api.post<Album>("/api/albums", data),
  update: (id: string, data: Partial<Album>) =>
    api.patch<Album>(`/api/albums/${id}`, data),
  delete: (id: string) => api.delete(`/api/albums/${id}`),

  // ── Publishing & sharing ─────────────────────────────────────────────
  publish: (id: string) => api.post(`/api/albums/${id}/publish`),
  share: (id: string) => api.post<{ token: string }>(`/api/albums/${id}/share`),
  like: (id: string) => api.post(`/api/albums/${id}/like`),
  fork: (id: string) => api.post<Album>(`/api/albums/${id}/fork`),

  // ── AI & export ──────────────────────────────────────────────────────
  autotag: (id: string) => api.post(`/api/albums/${id}/autotag`),
  export: (id: string, format: string) =>
    api.post(`/api/albums/${id}/export`, { format }),

  // ── Comments ─────────────────────────────────────────────────────────
  getComments: (id: string) =>
    api.get<SectionComment[]>(`/api/albums/${id}/comments`),
  addComment: (id: string, data: CreateCommentInput) =>
    api.post(`/api/albums/${id}/comments`, data),

  // ── Tasks ────────────────────────────────────────────────────────────
  getTasks: (id: string) => api.get<AlbumTask[]>(`/api/albums/${id}/tasks`),
  createTask: (id: string, data: CreateTaskInput) =>
    api.post(`/api/albums/${id}/tasks`, data),
  updateTask: (id: string, taskId: string, data: Partial<AlbumTask>) =>
    api.patch(`/api/albums/${id}/tasks/${taskId}`, data),
  deleteTask: (id: string, taskId: string) =>
    api.delete(`/api/albums/${id}/tasks/${taskId}`),

  // ── Versions ─────────────────────────────────────────────────────────
  getVersions: (id: string) =>
    api.get<AlbumVersion[]>(`/api/albums/${id}/versions`),
  createVersion: (id: string, message: string) =>
    api.post(`/api/albums/${id}/versions`, { message }),
  restoreVersion: (id: string, versionId: string) =>
    api.post(`/api/albums/${id}/versions/${versionId}/restore`),
};
