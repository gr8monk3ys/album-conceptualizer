/** Shared API response types matching the Next.js BFF endpoints. */

// ── Auth ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface AuthSession {
  jwt: string;
  user: User;
}

// ── Workspace ─────────────────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  user: User;
}

// ── Album ─────────────────────────────────────────────────────────────
export interface Album {
  id: string;
  workspaceId: string;
  title: string;
  artist: string;
  conceptSummary: string | null;
  primaryGenre: string | null;
  centralThemes: string[];
  trackCount: number;
  coverUrl: string | null;
  status: "draft" | "published";
  isPublic: boolean;
  publishedAt: string | null;
  data: AlbumData | null;
  songs: Song[];
  createdAt: string;
  updatedAt: string;
}

export interface AlbumData {
  title: string;
  artist: string;
  concept_summary: string;
  primary_genre: string;
  secondary_genres: string[];
  central_themes: string[];
  recurring_motifs: string[];
  release_year: number | null;
  reference_albums: string[];
  visual_inspiration: string[];
  songs: SongData[];
}

export interface Song {
  id: string;
  albumId: string;
  trackNumber: number;
  title: string;
  key: string | null;
  tempo: number | null;
  narrativeSummary: string | null;
  sections: Section[];
}

export interface SongData {
  title: string;
  track_number: number;
  key: string;
  tempo: number;
  time_signature: string;
  narrative_position: string;
  narrative_summary: string;
  themes: string[];
  motifs: string[];
  characters: string[];
  mood_tags: string[];
  sections: SectionData[];
}

export interface Section {
  id: string;
  songId: string;
  sectionType: string;
  order: number;
  lyrics: string | null;
  chordProgression: string[];
}

export interface SectionData {
  section_type: string;
  order: number;
  lyrics: string;
  chord_progression: string[];
  duration_bars: number;
  narrative_function: string;
  emotional_arc: string;
  key: string | null;
  tempo_modifier: string | null;
  dynamics: string | null;
}

// ── Album Bible ───────────────────────────────────────────────────────
export interface AlbumBible {
  logline: string;
  synopsis: string;
  setting: string;
  themes: BibleTheme[];
  characters: BibleCharacter[];
  motifs: BibleMotif[];
  style_profiles: BibleStyleProfile[];
}

export interface BibleTheme {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  valence: number;
  arousal: number;
  primary_songs: number[];
  secondary_songs: number[];
}

export interface BibleCharacter {
  id: string;
  name: string;
  role: string;
  traits: string[];
  arc: string;
  associated_key: string | null;
  vocal_style: string | null;
  appearances: number[];
}

export interface BibleMotif {
  id: string;
  name: string;
  type: "lyrical" | "musical" | "rhythmic";
  chord_pattern: string[];
  melodic_contour: string | null;
  key_phrases: string[];
  imagery: string[];
  evolution_notes: string;
}

export interface BibleStyleProfile {
  id: string;
  primary_genre: string;
  subgenres: string[];
  era_influence: string;
  reference_artists: string[];
  reference_albums: string[];
  instrumentation: string[];
  production_notes: string;
}

// ── Comments ──────────────────────────────────────────────────────────
export interface SectionComment {
  id: string;
  albumId: string;
  sectionId: string | null;
  songTrackNumber: number;
  sectionType: string;
  sectionOrder: number;
  authorUserId: string;
  author: User;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

// ── Tasks ─────────────────────────────────────────────────────────────
export interface AlbumTask {
  id: string;
  albumId: string;
  title: string;
  body: string | null;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  createdByUserId: string;
  assignedToUserId: string | null;
  assignedTo: User | null;
  sourceCommentId: string | null;
  sectionId: string | null;
  songTrackNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────
export interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  actorUserId: string | null;
  actor: User | null;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  albumId: string | null;
  commentId: string | null;
  taskId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Cursor-paginated list responses ──────────────────────────────────
export interface AlbumListResponse {
  albums: Album[];
  nextCursor: string | undefined;
  hasMore: boolean;
}

export interface CommentListResponse {
  comments: SectionComment[];
  nextCursor: string | undefined;
  hasMore: boolean;
}

export interface TaskListResponse {
  tasks: AlbumTask[];
  nextCursor: string | undefined;
  hasMore: boolean;
}

export interface MemberListResponse {
  members: WorkspaceMember[];
  nextCursor: string | undefined;
  hasMore: boolean;
}

// ── Versions ──────────────────────────────────────────────────────────
export interface AlbumVersion {
  id: string;
  albumId: string;
  createdByUserId: string;
  createdBy: User;
  message: string | null;
  data: AlbumData;
  createdAt: string;
}

// ── Billing ───────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  plan: "free" | "pro" | "team";
  status: "inactive" | "active";
  currentPeriodEnd: string | null;
}

export interface CreditBalance {
  balance: number;
}

// ── Audio Generation ──────────────────────────────────────────────────
export interface AudioGenResult {
  status: "pending" | "processing" | "completed" | "failed";
  audio_url: string | null;
  error: string | null;
  model_id: string;
}

// ── Input types ──────────────────────────────────────────────────────
export interface CreateAlbumInput {
  title: string;
  artist: string;
  conceptSummary?: string;
  primaryGenre?: string;
  centralThemes?: string[];
}

export interface CreateCommentInput {
  body: string;
  sectionId?: string;
  songTrackNumber: number;
  sectionType: string;
  sectionOrder: number;
}

export interface CreateTaskInput {
  title: string;
  body?: string;
  priority?: AlbumTask["priority"];
  dueAt?: string;
  assignedToUserId?: string;
  sourceCommentId?: string;
  sectionId?: string;
  songTrackNumber?: number;
}

// ── Audio Input ──────────────────────────────────────────────────────
export interface AudioPreviewInput {
  chords: string[];
  key: string;
  tempo: number;
}

export interface AudioGenerateInput {
  prompt: string;
  duration: number;
}

// ── Voice Memos ──────────────────────────────────────────────────────
export interface VoiceMemo {
  id: string;
  albumId: string;
  songId: string | null;
  sectionId: string | null;
  authorUserId: string;
  audioUrl: string;
  durationMs: number;
  title: string | null;
  createdAt: string;
  author: User;
}

// ── API Responses ─────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
