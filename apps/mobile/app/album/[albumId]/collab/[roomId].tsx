import { useLocalSearchParams } from "expo-router";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
  Users,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { Avatar, Badge, Button, Card } from "../../../../src/components/ui";
import { hapticMedium } from "../../../../src/utils/haptics";
import { useCollabRoom } from "../../../../src/hooks/use-collab";
import type {
  CollabBoardItem,
  CollabComment,
  CollabConnectionStatus,
  CollabSnapshot,
} from "../../../../src/api/collab";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../../src/theme";

// ── Tab types ────────────────────────────────────────────────────────

type TabKey = "chat" | "board" | "snapshots";

interface TabDef {
  key: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: "chat", label: "Chat" },
  { key: "board", label: "Board" },
  { key: "snapshots", label: "Snapshots" },
];

// ── Segmented control ────────────────────────────────────────────────

interface SegmentedControlProps {
  tabs: TabDef[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

function SegmentedControl({
  tabs,
  activeTab,
  onTabChange,
}: SegmentedControlProps): ReactNode {
  return (
    <View style={styles.segmentedControl}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={[
              styles.segmentTab,
              isActive && styles.segmentTabActive,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                isActive && styles.segmentLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Chat message row ─────────────────────────────────────────────────

interface ChatMessageProps {
  comment: CollabComment;
}

function ChatMessage({ comment }: ChatMessageProps): ReactNode {
  const time = new Date(comment.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.chatMessage}>
      <Avatar name={comment.alias} size="sm" />
      <View style={styles.chatBubble}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatAlias}>{comment.alias}</Text>
          <Text style={styles.chatTime}>{time}</Text>
        </View>
        <Text style={styles.chatText}>{comment.message}</Text>
        {comment.track_number != null && (
          <Badge text={`Track ${comment.track_number}`} variant="info" />
        )}
      </View>
    </View>
  );
}

// ── Board item card ──────────────────────────────────────────────────

interface BoardItemCardProps {
  item: CollabBoardItem;
  onVote: (value: -1 | 0 | 1) => void;
}

function BoardItemCard({ item, onVote }: BoardItemCardProps): ReactNode {
  function getStatusVariant(): "default" | "info" | "success" {
    switch (item.status) {
      case "idea":
        return "default";
      case "active":
        return "info";
      case "done":
        return "success";
    }
  }

  return (
    <Card style={styles.boardCard}>
      <View style={styles.boardCardHeader}>
        <Text style={styles.boardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Badge text={item.status} variant={getStatusVariant()} />
      </View>
      {item.detail && (
        <Text style={styles.boardDetail} numberOfLines={3}>
          {item.detail}
        </Text>
      )}
      <View style={styles.boardFooter}>
        <Text style={styles.boardAlias}>{item.alias}</Text>
        <View style={styles.voteRow}>
          <Pressable
            onPress={() => {
              hapticMedium();
              onVote(1);
            }}
            style={styles.voteButton}
          >
            <ChevronUp size={18} color={colors.success} />
          </Pressable>
          <Text style={styles.voteScore}>{item.vote_score}</Text>
          <Pressable
            onPress={() => {
              hapticMedium();
              onVote(-1);
            }}
            style={styles.voteButton}
          >
            <ChevronDown size={18} color={colors.error} />
          </Pressable>
          <Text style={styles.voterCount}>
            {item.voter_count} vote{item.voter_count !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ── Snapshot row ─────────────────────────────────────────────────────

interface SnapshotRowProps {
  snapshot: CollabSnapshot;
}

function SnapshotRow({ snapshot }: SnapshotRowProps): ReactNode {
  const time = new Date(snapshot.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(snapshot.created_at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <Card style={styles.snapshotCard}>
      <View style={styles.snapshotHeader}>
        <Avatar name={snapshot.alias} size="sm" />
        <View style={styles.snapshotMeta}>
          <Text style={styles.snapshotAlias}>{snapshot.alias}</Text>
          <Text style={styles.snapshotTime}>
            {date} at {time}
          </Text>
        </View>
      </View>
      <Text style={styles.snapshotSummary}>{snapshot.summary}</Text>
    </Card>
  );
}

// ── Connection status banner ──────────────────────────────────────────

interface ConnectionBannerProps {
  status: CollabConnectionStatus;
  onRetry: () => void;
}

function ConnectionBanner({ status, onRetry }: ConnectionBannerProps): ReactNode {
  if (status === "connected") return null;

  if (status === "connecting") {
    return (
      <View style={styles.bannerConnecting}>
        <ActivityIndicator size="small" color={colors.warning} />
        <Text style={styles.bannerText}>Connecting...</Text>
      </View>
    );
  }

  // status === "error" or "disconnected"
  return (
    <View style={styles.bannerError}>
      <WifiOff size={16} color={colors.error} />
      <Text style={styles.bannerErrorText}>
        {status === "error"
          ? "Unable to connect to collaboration server"
          : "Connection lost"}
      </Text>
      <Pressable onPress={onRetry} style={styles.bannerRetryButton}>
        <RefreshCw size={14} color={colors.primary} />
        <Text style={styles.bannerRetryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ── Unavailable overlay (shown over content when disconnected) ────────

interface UnavailableOverlayProps {
  status: CollabConnectionStatus;
  onRetry: () => void;
}

function UnavailableOverlay({ status, onRetry }: UnavailableOverlayProps): ReactNode {
  if (status === "connected" || status === "connecting") return null;

  return (
    <View style={styles.unavailableOverlay}>
      <View style={styles.unavailableCard}>
        <WifiOff size={40} color={colors.textMuted} />
        <Text style={styles.unavailableTitle}>
          Real-time collaboration is currently unavailable
        </Text>
        <Text style={styles.unavailableMessage}>
          Your changes are saved locally. Collaboration features will be
          available in a future update.
        </Text>
        <Button
          title="Retry Connection"
          onPress={onRetry}
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={16} color={colors.text} />}
        />
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function CollabRoomScreen(): ReactNode {
  const { albumId, roomId } = useLocalSearchParams<{
    albumId: string;
    roomId: string;
  }>();
  const [alias] = useState(() => `User-${Math.floor(Math.random() * 1000)}`);
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [messageText, setMessageText] = useState("");
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaDetail, setNewIdeaDetail] = useState("");
  const [snapshotSummary, setSnapshotSummary] = useState("");
  const chatListRef = useRef<FlatList<CollabComment>>(null);

  const {
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
  } = useCollabRoom(albumId, roomId, alias);

  const isDisconnected = status === "error" || status === "disconnected";

  // ── Chat actions ─────────────────────────────────────────────────

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    sendComment(trimmed);
    setMessageText("");
  }, [messageText, sendComment]);

  // ── Board actions ────────────────────────────────────────────────

  const handleAddIdea = useCallback(() => {
    const title = newIdeaTitle.trim();
    if (!title) {
      Alert.alert("Required", "Please enter an idea title.");
      return;
    }
    createBoardItem(title, newIdeaDetail.trim() || undefined);
    setNewIdeaTitle("");
    setNewIdeaDetail("");
  }, [newIdeaTitle, newIdeaDetail, createBoardItem]);

  // ── Snapshot actions ─────────────────────────────────────────────

  const handleSaveSnapshot = useCallback(() => {
    const summary = snapshotSummary.trim();
    if (!summary) {
      Alert.alert("Required", "Please enter a snapshot summary.");
      return;
    }
    createSnapshot(summary);
    setSnapshotSummary("");
  }, [snapshotSummary, createSnapshot]);

  // ── Render helpers ───────────────────────────────────────────────

  function renderChatTab(): ReactNode {
    return (
      <KeyboardAvoidingView
        style={styles.tabContent}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={140}
      >
        <FlatList
          ref={chatListRef}
          data={comments}
          keyExtractor={(item, i) => `${item.created_at}-${item.alias}-${i}`}
          renderItem={({ item }) => <ChatMessage comment={item} />}
          contentContainerStyle={styles.chatList}
          inverted={false}
          onContentSizeChange={() =>
            chatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          }
        />
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSendMessage}
            style={styles.sendButton}
            disabled={!messageText.trim()}
          >
            <Send
              size={20}
              color={
                messageText.trim() ? colors.primary : colors.textMuted
              }
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderBoardTab(): ReactNode {
    return (
      <View style={styles.tabContent}>
        <FlatList
          data={boardItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BoardItemCard
              item={item}
              onVote={(value) => sendVote(item.id, value)}
            />
          )}
          contentContainerStyle={styles.boardList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Lightbulb size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                No ideas yet. Add the first one!
              </Text>
            </View>
          }
        />
        <View style={styles.addIdeaSection}>
          <TextInput
            style={styles.ideaInput}
            placeholder="Idea title..."
            placeholderTextColor={colors.textMuted}
            value={newIdeaTitle}
            onChangeText={setNewIdeaTitle}
          />
          <TextInput
            style={[styles.ideaInput, styles.ideaDetailInput]}
            placeholder="Detail (optional)"
            placeholderTextColor={colors.textMuted}
            value={newIdeaDetail}
            onChangeText={setNewIdeaDetail}
            multiline
          />
          <Button
            title="Add Idea"
            onPress={handleAddIdea}
            size="sm"
            icon={<Lightbulb size={16} color={colors.white} />}
          />
        </View>
      </View>
    );
  }

  function renderSnapshotsTab(): ReactNode {
    return (
      <View style={styles.tabContent}>
        <FlatList
          data={snapshots}
          keyExtractor={(item, i) => `${item.created_at}-${item.alias}-${i}`}
          renderItem={({ item }) => <SnapshotRow snapshot={item} />}
          contentContainerStyle={styles.snapshotList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Camera size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                No snapshots yet. Save your progress!
              </Text>
            </View>
          }
        />
        <View style={styles.snapshotInputSection}>
          <TextInput
            style={[styles.ideaInput, styles.ideaDetailInput]}
            placeholder="Snapshot summary..."
            placeholderTextColor={colors.textMuted}
            value={snapshotSummary}
            onChangeText={setSnapshotSummary}
            multiline
          />
          <Button
            title="Save Snapshot"
            onPress={handleSaveSnapshot}
            size="sm"
            icon={<Camera size={16} color={colors.white} />}
          />
        </View>
      </View>
    );
  }

  function renderActiveTab(): ReactNode {
    switch (activeTab) {
      case "chat":
        return renderChatTab();
      case "board":
        return renderBoardTab();
      case "snapshots":
        return renderSnapshotsTab();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.container}>
        {/* Connection status banner */}
        <ConnectionBanner status={status} onRetry={retry} />

        {/* Header bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.roomTitle}>Collab Room</Text>
            <View style={styles.headerMeta}>
              <View
                style={[
                  styles.connectionDot,
                  {
                    backgroundColor:
                      status === "connected"
                        ? colors.success
                        : status === "connecting"
                          ? colors.warning
                          : colors.error,
                  },
                ]}
              />
              <Text style={styles.connectionText}>
                {status === "connected"
                  ? "Connected"
                  : status === "connecting"
                    ? "Connecting..."
                    : "Disconnected"}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Users size={16} color={colors.textSecondary} />
            <Badge text={String(participants.length)} variant="default" />
          </View>
        </View>

        {/* Participant avatars */}
        {participants.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantRow}
          >
            {participants.map((p) => (
              <View key={p.alias} style={styles.participantItem}>
                <Avatar name={p.alias} size="sm" />
                <Text style={styles.participantAlias} numberOfLines={1}>
                  {p.alias}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Tab control */}
        <SegmentedControl
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab content — dimmed when disconnected */}
        <View
          style={[styles.tabContentWrapper, isDisconnected && styles.tabContentDimmed]}
          pointerEvents={isDisconnected ? "none" : "auto"}
        >
          {renderActiveTab()}
        </View>

        {/* Unavailable overlay shown on top of dimmed content */}
        <UnavailableOverlay status={status} onRetry={retry} />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },

  // Connection banner
  bannerConnecting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.2)",
  },
  bannerText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 68, 68, 0.2)",
  },
  bannerErrorText: {
    flex: 1,
    color: colors.error,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  bannerRetryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  bannerRetryText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // Unavailable overlay
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 160, // below header + banner area
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 10, 0.7)",
    zIndex: 10,
  },
  unavailableCard: {
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing["2xl"],
    gap: spacing.lg,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  unavailableTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
  },
  unavailableMessage: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },

  // Dimmed content wrapper
  tabContentWrapper: {
    flex: 1,
  },
  tabContentDimmed: {
    opacity: 0.3,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerLeft: {
    gap: spacing.xs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roomTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // Participants
  participantRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  participantItem: {
    alignItems: "center",
    gap: spacing.xs,
    width: 52,
  },
  participantAlias: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "center",
  },

  // Segmented control
  segmentedControl: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  segmentTabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: colors.text,
  },

  // Tab content
  tabContent: {
    flex: 1,
  },

  // Chat
  chatList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    flexGrow: 1,
  },
  chatMessage: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  chatBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatAlias: {
    color: colors.primaryLight,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  chatTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  chatText: {
    color: colors.text,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: fontSize.base,
  },
  sendButton: {
    padding: spacing.sm,
  },

  // Board
  boardList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexGrow: 1,
  },
  boardCard: {
    gap: spacing.sm,
  },
  boardCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  boardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  boardDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  boardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardAlias: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  voteButton: {
    padding: spacing.xs,
  },
  voteScore: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  voterCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
  },

  // Add idea section
  addIdeaSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  ideaInput: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  ideaDetailInput: {
    minHeight: 48,
    textAlignVertical: "top",
  },

  // Snapshots
  snapshotList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexGrow: 1,
  },
  snapshotCard: {
    gap: spacing.sm,
  },
  snapshotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  snapshotMeta: {
    flex: 1,
    gap: 2,
  },
  snapshotAlias: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  snapshotTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  snapshotSummary: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  snapshotInputSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
