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

/** Granular connection state for UI feedback. */
export type CollabConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

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

/** Response from the /api/collab/status health-check endpoint. */
export interface CollabStatusResponse {
  status: "available" | "unavailable";
  message: string;
}

// ── Health check ─────────────────────────────────────────────────────

/**
 * Check whether the collab WebSocket server is available before
 * attempting a connection.  Returns the status response or null
 * if the endpoint itself is unreachable.
 */
export async function checkCollabHealth(
  baseUrl: string,
): Promise<CollabStatusResponse | null> {
  try {
    const res = await fetch(`${baseUrl}/api/collab/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as CollabStatusResponse;
  } catch {
    return null;
  }
}

// ── Client ───────────────────────────────────────────────────────────

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;
/** Maximum number of consecutive reconnect attempts before giving up. */
const MAX_RETRY_ATTEMPTS = 3;

export class CollabClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private hasEverConnected = false;
  private _status: CollabConnectionStatus = "disconnected";

  // Event callbacks
  onParticipants: ((participants: Participant[]) => void) | null = null;
  onComment: ((comment: CollabComment) => void) | null = null;
  onBoardItem: ((item: CollabBoardItem) => void) | null = null;
  onSnapshot: ((snapshot: CollabSnapshot) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  /** @deprecated – use onStatusChange for granular status updates. */
  onConnectionChange: ((connected: boolean) => void) | null = null;
  /** Called whenever the connection status changes. */
  onStatusChange: ((status: CollabConnectionStatus) => void) | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly albumId: string,
    private readonly roomId: string,
    private readonly alias: string,
  ) {}

  /** Current connection status. */
  getStatus(): CollabConnectionStatus {
    return this._status;
  }

  // ── Connection lifecycle ─────────────────────────────────────────

  /**
   * Attempt to connect.  When `checkHealth` is true (the default) the
   * client will first query the `/api/collab/status` endpoint and skip
   * the WebSocket connection entirely when the server reports
   * "unavailable".
   */
  async connect(checkHealth = true): Promise<void> {
    this.intentionalClose = false;

    // Optionally pre-flight against the health endpoint.
    if (checkHealth) {
      this.setStatus("connecting");
      const health = await checkCollabHealth(this.baseUrl);
      if (health && health.status === "unavailable") {
        this.setStatus("error");
        this.onError?.(health.message);
        return;
      }
    }

    this.connectWebSocket();
  }

  /** Raw WebSocket connection (no health pre-flight). */
  private connectWebSocket(): void {
    this.setStatus("connecting");

    const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const host = this.baseUrl.replace(/^https?:\/\//, "");
    const url = `${protocol}://${host}/collab/albums/${this.albumId}/rooms/${this.roomId}?alias=${encodeURIComponent(this.alias)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.hasEverConnected = true;
      this.setStatus("connected");
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
      } else {
        this.setStatus("disconnected");
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
    this.setStatus("disconnected");
    this.onParticipants = null;
    this.onComment = null;
    this.onBoardItem = null;
    this.onSnapshot = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onStatusChange = null;
  }

  /** Reset retry counter and attempt a fresh connection. */
  async retry(): Promise<void> {
    this.reconnectAttempts = 0;
    this.hasEverConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.intentionalClose = true;
      this.ws.close();
      this.ws = null;
      this.intentionalClose = false;
    }
    await this.connect(true);
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

  private setStatus(status: CollabConnectionStatus): void {
    if (status === this._status) return;
    this._status = status;
    this.onStatusChange?.(status);
  }

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
    // If we have exhausted retries, give up and surface an error.
    if (this.reconnectAttempts >= MAX_RETRY_ATTEMPTS) {
      this.setStatus("error");
      this.onError?.(
        "Unable to connect to the collaboration server after multiple attempts.",
      );
      return;
    }

    this.setStatus("connecting");

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }
}
