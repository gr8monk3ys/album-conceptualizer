/** Songs & Sections API — CRUD endpoints for song and section editing. */
import { api } from "./client";
import type { Song, Section } from "./types";

// ── Input types ──────────────────────────────────────────────────────

export interface CreateSongInput {
  title: string;
  trackNumber: number;
  key?: string;
  tempo?: number;
  narrativeSummary?: string;
}

export interface UpdateSongInput {
  title?: string;
  trackNumber?: number;
  key?: string | null;
  tempo?: number | null;
  narrativeSummary?: string | null;
}

export interface CreateSectionInput {
  sectionType: string;
  order?: number;
  lyrics?: string;
  chordProgression?: string[];
}

export interface UpdateSectionInput {
  sectionType?: string;
  order?: number;
  lyrics?: string | null;
  chordProgression?: string[];
}

// ── API functions ────────────────────────────────────────────────────

export const songsApi = {
  // ── Songs ───────────────────────────────────────────────────────────
  list: (albumId: string) =>
    api.get<Song[]>(`/api/albums/${albumId}/songs`),
  create: (albumId: string, data: CreateSongInput) =>
    api.post<Song>(`/api/albums/${albumId}/songs`, data),
  update: (albumId: string, songId: string, data: UpdateSongInput) =>
    api.patch<Song>(`/api/albums/${albumId}/songs/${songId}`, data),
  delete: (albumId: string, songId: string) =>
    api.delete(`/api/albums/${albumId}/songs/${songId}`),

  // ── Sections ────────────────────────────────────────────────────────
  listSections: (albumId: string, songId: string) =>
    api.get<Section[]>(`/api/albums/${albumId}/songs/${songId}/sections`),
  createSection: (
    albumId: string,
    songId: string,
    data: CreateSectionInput,
  ) =>
    api.post<Section>(
      `/api/albums/${albumId}/songs/${songId}/sections`,
      data,
    ),
  updateSection: (
    albumId: string,
    songId: string,
    sectionId: string,
    data: UpdateSectionInput,
  ) =>
    api.patch<Section>(
      `/api/albums/${albumId}/songs/${songId}/sections/${sectionId}`,
      data,
    ),
  deleteSection: (albumId: string, songId: string, sectionId: string) =>
    api.delete(
      `/api/albums/${albumId}/songs/${songId}/sections/${sectionId}`,
    ),
};
