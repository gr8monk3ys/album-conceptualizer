import { useLocalSearchParams } from "expo-router";
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  Plus,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import type { ListRenderItemInfo } from "react-native";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  LoadingInline,
} from "../../../src/components/ui";
import {
  useAddComment,
  useAlbum,
  useAlbumComments,
  useAlbumTasks,
  useCreateTask,
  useUpdateTask,
} from "../../../src/hooks/use-albums";
import type {
  AlbumTask,
  CreateCommentInput,
  CreateTaskInput,
  SectionComment,
  Song,
} from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Segment control ──────────────────────────────────────────────────

type InboxTab = "comments" | "tasks";

interface SegmentControlProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  commentCount: number;
  taskCount: number;
}

function SegmentControl({
  activeTab,
  onTabChange,
  commentCount,
  taskCount,
}: SegmentControlProps): ReactNode {
  return (
    <View style={styles.segmentContainer}>
      <Pressable
        onPress={() => onTabChange("comments")}
        style={[
          styles.segmentItem,
          activeTab === "comments" && styles.segmentItemActive,
        ]}
      >
        <MessageSquare
          size={16}
          color={activeTab === "comments" ? colors.white : colors.textMuted}
        />
        <Text
          style={[
            styles.segmentText,
            activeTab === "comments" && styles.segmentTextActive,
          ]}
        >
          Comments ({commentCount})
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("tasks")}
        style={[
          styles.segmentItem,
          activeTab === "tasks" && styles.segmentItemActive,
        ]}
      >
        <CheckSquare
          size={16}
          color={activeTab === "tasks" ? colors.white : colors.textMuted}
        />
        <Text
          style={[
            styles.segmentText,
            activeTab === "tasks" && styles.segmentTextActive,
          ]}
        >
          Tasks ({taskCount})
        </Text>
      </Pressable>
    </View>
  );
}

// ── Comment row ──────────────────────────────────────────────────────

interface CommentRowProps {
  comment: SectionComment;
}

function CommentRow({ comment }: CommentRowProps): ReactNode {
  const isResolved = comment.resolvedAt !== null;
  const authorName = comment.author?.name ?? "Unknown";

  return (
    <Card style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <Avatar
          name={authorName}
          uri={comment.author?.image ?? undefined}
          size="sm"
        />
        <View style={styles.commentHeaderInfo}>
          <Text style={styles.commentAuthor}>{authorName}</Text>
          <Text style={styles.commentTime}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        {isResolved && <Badge text="Resolved" variant="success" />}
      </View>

      <Text
        style={[
          styles.commentBody,
          isResolved && styles.commentBodyResolved,
        ]}
      >
        {comment.body}
      </Text>

      <View style={styles.commentRef}>
        <Text style={styles.commentRefText}>
          Track {comment.songTrackNumber} - {comment.sectionType} #{comment.sectionOrder}
        </Text>
      </View>
    </Card>
  );
}

// ── Task row ─────────────────────────────────────────────────────────

type TaskStatusVariant = "default" | "info" | "success";
type TaskPriorityVariant = "default" | "info" | "warning" | "error";

const STATUS_VARIANT: Record<AlbumTask["status"], TaskStatusVariant> = {
  open: "default",
  in_progress: "info",
  done: "success",
};

const PRIORITY_VARIANT: Record<AlbumTask["priority"], TaskPriorityVariant> = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "error",
};

interface TaskRowProps {
  task: AlbumTask;
  onStatusChange: (status: AlbumTask["status"]) => void;
}

function TaskRow({ task, onStatusChange }: TaskRowProps): ReactNode {
  const [expanded, setExpanded] = useState(false);

  function cycleStatus(): void {
    if (task.status === "open") {
      onStatusChange("in_progress");
    } else if (task.status === "in_progress") {
      onStatusChange("done");
    } else {
      onStatusChange("open");
    }
  }

  return (
    <Card onPress={() => setExpanded(!expanded)}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskTitle} numberOfLines={expanded ? undefined : 1}>
            {task.title}
          </Text>
        </View>
        <View style={styles.taskBadges}>
          <Badge text={task.status} variant={STATUS_VARIANT[task.status]} />
          <Badge text={task.priority} variant={PRIORITY_VARIANT[task.priority]} />
        </View>
      </View>

      <View style={styles.taskMeta}>
        {task.assignedTo && (
          <View style={styles.taskAssignee}>
            <Avatar
              name={task.assignedTo.name ?? "?"}
              uri={task.assignedTo.image ?? undefined}
              size="sm"
            />
            <Text style={styles.taskAssigneeName}>
              {task.assignedTo.name ?? "Unassigned"}
            </Text>
          </View>
        )}
        {task.dueAt && (
          <View style={styles.taskDue}>
            <Calendar size={12} color={colors.textMuted} />
            <Text style={styles.taskDueText}>
              {new Date(task.dueAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.taskExpanded}>
          {task.body && (
            <Text style={styles.taskBody}>{task.body}</Text>
          )}
          <View style={styles.taskActions}>
            <Button
              title={
                task.status === "open"
                  ? "Start"
                  : task.status === "in_progress"
                    ? "Complete"
                    : "Reopen"
              }
              onPress={cycleStatus}
              size="sm"
              variant={task.status === "done" ? "ghost" : "primary"}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

// ── Add comment modal ────────────────────────────────────────────────

interface AddCommentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCommentInput) => void;
  songs: Song[];
  loading: boolean;
}

function AddCommentModal({
  visible,
  onClose,
  onSubmit,
  songs,
  loading,
}: AddCommentModalProps): ReactNode {
  const [body, setBody] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(1);

  function handleSubmit(): void {
    if (!body.trim()) return;
    onSubmit({
      body: body.trim(),
      songTrackNumber: selectedTrack,
      sectionType: "general",
      sectionOrder: 0,
    });
    setBody("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Input
            label="Comment"
            placeholder="Write your comment..."
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
          />

          <View style={styles.modalSpacer} />

          <Text style={styles.fieldLabel}>Song</Text>
          <View style={styles.songPickerRow}>
            {songs.map((song) => (
              <Chip
                key={song.id}
                label={`${song.trackNumber}. ${song.title}`}
                selected={selectedTrack === song.trackNumber}
                onPress={() => setSelectedTrack(song.trackNumber)}
              />
            ))}
          </View>

          <View style={styles.modalSpacer} />

          <Button
            title="Post Comment"
            onPress={handleSubmit}
            loading={loading}
            disabled={!body.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Add task modal ───────────────────────────────────────────────────

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => void;
  loading: boolean;
}

const PRIORITIES: AlbumTask["priority"][] = ["low", "medium", "high", "urgent"];

function AddTaskModal({
  visible,
  onClose,
  onSubmit,
  loading,
}: AddTaskModalProps): ReactNode {
  const [title, setTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [priority, setPriority] = useState<AlbumTask["priority"]>("medium");

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      body: taskBody.trim() || undefined,
      priority,
    });
    setTitle("");
    setTaskBody("");
    setPriority("medium");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <Pressable onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Input
            label="Title"
            placeholder="Task title..."
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.modalSpacer} />

          <Input
            label="Description"
            placeholder="Optional details..."
            value={taskBody}
            onChangeText={setTaskBody}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalSpacer} />

          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={p.charAt(0).toUpperCase() + p.slice(1)}
                selected={priority === p}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>

          <View style={styles.modalSpacer} />

          <Button
            title="Create Task"
            onPress={handleSubmit}
            loading={loading}
            disabled={!title.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function InboxScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const { data: album } = useAlbum(albumId);
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
    refetch: refetchComments,
    isRefetching: commentsRefetching,
    fetchNextPage: fetchNextCommentsPage,
    hasNextPage: hasNextCommentsPage,
    isFetchingNextPage: isFetchingNextCommentsPage,
  } = useAlbumComments(albumId);
  const {
    data: tasksData,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
    isRefetching: tasksRefetching,
    fetchNextPage: fetchNextTasksPage,
    hasNextPage: hasNextTasksPage,
    isFetchingNextPage: isFetchingNextTasksPage,
  } = useAlbumTasks(albumId);

  const addComment = useAddComment();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [activeTab, setActiveTab] = useState<InboxTab>("comments");
  const [showAddComment, setShowAddComment] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  // FAB pulse animation
  const fabScale = useSharedValue(1);
  useEffect(() => {
    fabScale.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [fabScale]);
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const songs = useMemo(
    () => (album?.songs ?? []).sort((a, b) => a.trackNumber - b.trackNumber),
    [album],
  );

  const commentList = commentsData?.pages.flatMap((p) => p.comments) ?? [];
  const taskList = tasksData?.pages.flatMap((p) => p.tasks) ?? [];

  const handleAddComment = useCallback(
    (data: CreateCommentInput) => {
      addComment.mutate(
        { albumId, data },
        {
          onSuccess: () => {
            setShowAddComment(false);
            refetchComments();
          },
          onError: () => Alert.alert("Error", "Failed to add comment."),
        },
      );
    },
    [albumId, addComment, refetchComments],
  );

  const handleAddTask = useCallback(
    (data: CreateTaskInput) => {
      createTask.mutate(
        { albumId, data },
        {
          onSuccess: () => {
            setShowAddTask(false);
            refetchTasks();
          },
          onError: () => Alert.alert("Error", "Failed to create task."),
        },
      );
    },
    [albumId, createTask, refetchTasks],
  );

  const handleUpdateTaskStatus = useCallback(
    (taskId: string, status: AlbumTask["status"]) => {
      updateTask.mutate({ albumId, taskId, data: { status } });
    },
    [albumId, updateTask],
  );

  const handleCommentsEndReached = useCallback(() => {
    if (hasNextCommentsPage && !isFetchingNextCommentsPage) {
      fetchNextCommentsPage();
    }
  }, [hasNextCommentsPage, isFetchingNextCommentsPage, fetchNextCommentsPage]);

  const handleTasksEndReached = useCallback(() => {
    if (hasNextTasksPage && !isFetchingNextTasksPage) {
      fetchNextTasksPage();
    }
  }, [hasNextTasksPage, isFetchingNextTasksPage, fetchNextTasksPage]);

  const renderComment = useCallback(
    ({ item }: ListRenderItemInfo<SectionComment>) => (
      <CommentRow comment={item} />
    ),
    [],
  );

  const renderTask = useCallback(
    ({ item }: ListRenderItemInfo<AlbumTask>) => (
      <TaskRow
        task={item}
        onStatusChange={(status) => handleUpdateTaskStatus(item.id, status)}
      />
    ),
    [handleUpdateTaskStatus],
  );

  const isLoading = commentsLoading || tasksLoading;
  if (isLoading) {
    return <Loading />;
  }

  const isError = commentsError || tasksError;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          refetchComments();
          refetchTasks();
        }}
      />
    );
  }

  const isRefetching = activeTab === "comments" ? commentsRefetching : tasksRefetching;
  const handleRefresh = activeTab === "comments" ? refetchComments : refetchTasks;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <SegmentControl
        activeTab={activeTab}
        onTabChange={setActiveTab}
        commentCount={commentList.length}
        taskCount={taskList.length}
      />

      {activeTab === "comments" ? (
        <FlatList
          data={commentList}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => handleRefresh()}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleCommentsEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextCommentsPage ? <LoadingInline /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={MessageSquare}
              title="No Comments"
              description="Add comments to discuss specific sections of your album."
              action={{
                title: "Add Comment",
                onPress: () => setShowAddComment(true),
              }}
            />
          }
        />
      ) : (
        <FlatList
          data={taskList}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => handleRefresh()}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleTasksEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextTasksPage ? <LoadingInline /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={CheckSquare}
              title="No Tasks"
              description="Create tasks to track work items for your album."
              action={{
                title: "Add Task",
                onPress: () => setShowAddTask(true),
              }}
            />
          }
        />
      )}

      {/* FAB */}
      <Animated.View style={[styles.fab, fabAnimatedStyle]}>
        <Pressable
          onPress={() => {
            if (activeTab === "comments") {
              setShowAddComment(true);
            } else {
              setShowAddTask(true);
            }
          }}
          style={({ pressed }) => [
            styles.fabInner,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Plus size={24} color={colors.white} />
        </Pressable>
      </Animated.View>

      {/* Modals */}
      <AddCommentModal
        visible={showAddComment}
        onClose={() => setShowAddComment(false)}
        onSubmit={handleAddComment}
        songs={songs}
        loading={addComment.isPending}
      />

      <AddTaskModal
        visible={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSubmit={handleAddTask}
        loading={createTask.isPending}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Segment
  segmentContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.white,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    gap: spacing.sm,
    flexGrow: 1,
  },

  // Comment card
  commentCard: {
    gap: spacing.md,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  commentHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  commentTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  commentBody: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  commentBodyResolved: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  commentRef: {
    paddingTop: spacing.xs,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
  },
  commentRefText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "500",
  },

  // Task card
  taskHeader: {
    gap: spacing.sm,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  taskTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  taskBadges: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  taskAssignee: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  taskAssigneeName: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  taskDue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  taskDueText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  taskExpanded: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  taskBody: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  taskActions: {
    flexDirection: "row",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing["3xl"],
    gap: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  modalSpacer: {
    height: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  songPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
