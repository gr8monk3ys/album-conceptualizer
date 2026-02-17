/** Editor state — tracks the active editing context. */
import { create } from "zustand";

interface EditorState {
  /** Album currently being edited. */
  activeAlbumId: string | null;
  /** Song currently being edited. */
  activeSongId: string | null;
  /** Section currently being edited. */
  activeSectionId: string | null;
  /** Whether there are unsaved changes. */
  hasUnsavedChanges: boolean;

  setActiveAlbum: (albumId: string | null) => void;
  setActiveSong: (songId: string | null) => void;
  setActiveSection: (sectionId: string | null) => void;
  setHasUnsavedChanges: (dirty: boolean) => void;
  clearEditor: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeAlbumId: null,
  activeSongId: null,
  activeSectionId: null,
  hasUnsavedChanges: false,

  setActiveAlbum: (albumId) =>
    set({ activeAlbumId: albumId, activeSongId: null, activeSectionId: null }),
  setActiveSong: (songId) => set({ activeSongId: songId, activeSectionId: null }),
  setActiveSection: (sectionId) => set({ activeSectionId: sectionId }),
  setHasUnsavedChanges: (dirty) => set({ hasUnsavedChanges: dirty }),
  clearEditor: () =>
    set({
      activeAlbumId: null,
      activeSongId: null,
      activeSectionId: null,
      hasUnsavedChanges: false,
    }),
}));
