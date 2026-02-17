/** Album hooks — React Query wrappers for all album-related endpoints. */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { albumsApi } from "../api/albums";
import type {
  Album,
  AlbumTask,
  CreateAlbumInput,
  CreateCommentInput,
  CreateTaskInput,
} from "../api/types";

// ── Query keys ───────────────────────────────────────────────────────
const keys = {
  all: ["albums"] as const,
  detail: (id: string) => ["albums", id] as const,
  comments: (id: string) => ["albums", id, "comments"] as const,
  tasks: (id: string) => ["albums", id, "tasks"] as const,
  versions: (id: string) => ["albums", id, "versions"] as const,
};

// ── Queries ──────────────────────────────────────────────────────────

export function useAlbums() {
  return useQuery({
    queryKey: keys.all,
    queryFn: albumsApi.list,
  });
}

export function useAlbum(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => albumsApi.get(id),
    enabled: !!id,
  });
}

export function useAlbumComments(albumId: string) {
  return useQuery({
    queryKey: keys.comments(albumId),
    queryFn: () => albumsApi.getComments(albumId),
    enabled: !!albumId,
  });
}

export function useAlbumTasks(albumId: string) {
  return useQuery({
    queryKey: keys.tasks(albumId),
    queryFn: () => albumsApi.getTasks(albumId),
    enabled: !!albumId,
  });
}

export function useAlbumVersions(albumId: string) {
  return useQuery({
    queryKey: keys.versions(albumId),
    queryFn: () => albumsApi.getVersions(albumId),
    enabled: !!albumId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useCreateAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlbumInput) => albumsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useUpdateAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Album> }) =>
      albumsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: keys.detail(id) });
      const previous = qc.getQueryData<Album>(keys.detail(id));

      if (previous) {
        qc.setQueryData<Album>(keys.detail(id), { ...previous, ...data });
      }

      return { previous, id };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(keys.detail(context.id), context.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useDeleteAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => albumsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

// ── Comment mutations ────────────────────────────────────────────────

export function useAddComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      albumId,
      data,
    }: {
      albumId: string;
      data: CreateCommentInput;
    }) => albumsApi.addComment(albumId, data),
    onSuccess: (_data, { albumId }) => {
      qc.invalidateQueries({ queryKey: keys.comments(albumId) });
    },
  });
}

// ── Task mutations ───────────────────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      albumId,
      data,
    }: {
      albumId: string;
      data: CreateTaskInput;
    }) => albumsApi.createTask(albumId, data),
    onSuccess: (_data, { albumId }) => {
      qc.invalidateQueries({ queryKey: keys.tasks(albumId) });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      albumId,
      taskId,
      data,
    }: {
      albumId: string;
      taskId: string;
      data: Partial<AlbumTask>;
    }) => albumsApi.updateTask(albumId, taskId, data),
    onSuccess: (_data, { albumId }) => {
      qc.invalidateQueries({ queryKey: keys.tasks(albumId) });
    },
  });
}
