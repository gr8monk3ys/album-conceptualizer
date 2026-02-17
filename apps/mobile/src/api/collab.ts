/** WebSocket collaboration client for real-time collab rooms. */

// ── Types ────────────────────────────────────────────────────────────

export interface Participant {
  alias: string;
  role: string;
  joined_at: string;
}

export interface CollabComment {
  alias: string;
  message: string;
  track_number?: number;
  created_at: string;
}

export interface CollabBoardItem {
  id: string;
  alias: string;
  title: string;
  detail?: string;
  status: "idea" | "active" | "done";
  vote_score: number;
  voter_count: number;
}

export interface CollabSnapshot {
  alias: string;
  summary: string;
  created_at: string;
}

type CollabEventType =
  | "participants"
  | "comment"
  | "board_item"
  | "snapshot"
  | "error";

interface CollabEvent {
  type: CollabEventType;
  payload: unknown;
}

// ── Client ───────────────────────────────────────────────────────────

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

export class CollabClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  // Event callbacks
  onParticipants: ((participants: Participant[]) => void) | null = null;
  onComment: ((comment: CollabComment) => void) | null = null;
  onBoardItem: ((item: CollabBoardItem) => void) | null = null;
  onSnapshot: ((snapshot: CollabSnapshot) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly albumId: string,
    private readonly roomId: string,
    private readonly alias: string,
  ) {}

  // ── Connection lifecycle ─────────────────────────────────────────

  connect(): void {
    this.intentionalClose = false;
    const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const host = this.baseUrl.replace(/^https?:\/\//, "");
    const url = `${protocol}://${host}/collab/albums/${this.albumId}/rooms/${this.roomId}?alias=${encodeURIComponent(this.alias)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onConnectionChange?.(true);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onerror = () => {
      this.onError?.("WebSocket connection error");
    };

    this.ws.onclose = () => {
      this.onConnectionChange?.(false);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Outgoing actions ─────────────────────────────────────────────

  sendComment(message: string, trackNumber?: number): void {
    this.send({
      type: "comment",
      payload: { message, track_number: trackNumber },
    });
  }

  sendVote(itemId: string, value: -1 | 0 | 1): void {
    this.send({
      type: "vote",
      payload: { item_id: itemId, value },
    });
  }

  createBoardItem(title: string, detail?: string): void {
    this.send({
      type: "board_item",
      payload: { title, detail },
    });
  }

  createSnapshot(summary: string): void {
    this.send({
      type: "snapshot",
      payload: { summary },
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private send(event: { type: string; payload: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private handleMessage(raw: string): void {
    let event: CollabEvent;
    try {
      event = JSON.parse(raw) as CollabEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "participants":
        this.onParticipants?.(event.payload as Participant[]);
        break;
      case "comment":
        this.onComment?.(event.payload as CollabComment);
        break;
      case "board_item":
        this.onBoardItem?.(event.payload as CollabBoardItem);
        break;
      case "snapshot":
        this.onSnapshot?.(event.payload as CollabSnapshot);
        break;
      case "error":
        this.onError?.((event.payload as { message: string }).message);
        break;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
