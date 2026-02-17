/** React hook for managing a real-time collab room connection. */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CollabClient,
  type CollabBoardItem,
  type CollabComment,
  type CollabConnectionStatus,
  type CollabSnapshot,
  type Participant,
} from "../api/collab";
import { config } from "../config/env";

const BASE_URL = config.apiUrl;

interface UseCollabRoomReturn {
  /** @deprecated Use `status` instead for granular connection state. */
  connected: boolean;
  /** Granular connection status. */
  status: CollabConnectionStatus;
  participants: Participant[];
  comments: CollabComment[];
  boardItems: CollabBoardItem[];
  snapshots: CollabSnapshot[];
  sendComment: (message: string, trackNumber?: number) => void;
  sendVote: (itemId: string, value: -1 | 0 | 1) => void;
  createBoardItem: (title: string, detail?: string) => void;
  createSnapshot: (summary: string) => void;
  /** Manually retry the connection after failure. */
  retry: () => void;
}

export function useCollabRoom(
  albumId: string,
  roomId: string,
  alias: string,
): UseCollabRoomReturn {
  const clientRef = useRef<CollabClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<CollabConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [comments, setComments] = useState<CollabComment[]>([]);
  const [boardItems, setBoardItems] = useState<CollabBoardItem[]>([]);
  const [snapshots, setSnapshots] = useState<CollabSnapshot[]>([]);

  useEffect(() => {
    const client = new CollabClient(BASE_URL, albumId, roomId, alias);

    client.onConnectionChange = setConnected;
    client.onStatusChange = setStatus;
    client.onParticipants = setParticipants;
    client.onComment = (comment) =>
      setComments((prev) => [...prev, comment]);
    client.onBoardItem = (item) =>
      setBoardItems((prev) => {
        const existing = prev.findIndex((b) => b.id === item.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = item;
          return updated;
        }
        return [...prev, item];
      });
    client.onSnapshot = (snapshot) =>
      setSnapshots((prev) => [...prev, snapshot]);

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [albumId, roomId, alias]);

  const sendComment = useCallback(
    (message: string, trackNumber?: number) => {
      clientRef.current?.sendComment(message, trackNumber);
    },
    [],
  );

  const sendVote = useCallback(
    (itemId: string, value: -1 | 0 | 1) => {
      clientRef.current?.sendVote(itemId, value);
    },
    [],
  );

  const createBoardItem = useCallback(
    (title: string, detail?: string) => {
      clientRef.current?.createBoardItem(title, detail);
    },
    [],
  );

  const createSnapshot = useCallback(
    (summary: string) => {
      clientRef.current?.createSnapshot(summary);
    },
    [],
  );

  const retry = useCallback(() => {
    clientRef.current?.retry();
  }, []);

  return {
    connected,
    status,
    participants,
    comments,
    boardItems,
    snapshots,
    sendComment,
    sendVote,
    createBoardItem,
    createSnapshot,
    retry,
  };
}
