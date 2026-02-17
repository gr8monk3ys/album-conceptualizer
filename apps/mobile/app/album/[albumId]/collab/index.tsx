import { useLocalSearchParams, useRouter } from "expo-router";
import { Info, MessageCircle, Plus, WifiOff } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { Badge, Button, Card } from "../../../../src/components/ui";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../../src/theme";

// ── Placeholder room list ─────────────────────────────────────────────

interface RoomEntry {
  id: string;
  name: string;
  participantCount: number;
}

const PLACEHOLDER_ROOMS: RoomEntry[] = [];

// ── Main screen ───────────────────────────────────────────────────────

export default function CollabIndexScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const [newRoomName, setNewRoomName] = useState("");

  const handleCreateRoom = useCallback(() => {
    const name = newRoomName.trim();
    if (!name) {
      Alert.alert("Required", "Please enter a room name.");
      return;
    }
    // Generate a simple slug-style ID from the name
    const roomId = name.toLowerCase().replace(/\s+/g, "-").slice(0, 32);
    setNewRoomName("");
    router.push(`/album/${albumId}/collab/${roomId}` as never);
  }, [albumId, newRoomName, router]);

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      router.push(`/album/${albumId}/collab/${roomId}` as never);
    },
    [albumId, router],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.container}>
        {/* Beta banner */}
        <View style={styles.betaBanner}>
          <Info size={16} color={colors.info} />
          <Text style={styles.betaText}>
            Real-time sync is in beta. Some features may be unavailable.
          </Text>
        </View>

        {/* Create room section */}
        <View style={styles.createSection}>
          <Text style={styles.sectionTitle}>Join or Create a Room</Text>
          <View style={styles.createRow}>
            <TextInput
              style={styles.roomInput}
              placeholder="Room name..."
              placeholderTextColor={colors.textMuted}
              value={newRoomName}
              onChangeText={setNewRoomName}
              onSubmitEditing={handleCreateRoom}
              returnKeyType="go"
            />
            <Button
              title="Go"
              onPress={handleCreateRoom}
              size="sm"
              icon={<Plus size={16} color={colors.white} />}
            />
          </View>
        </View>

        {/* Room list */}
        <FlatList
          data={PLACEHOLDER_ROOMS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => handleJoinRoom(item.id)}>
              <Card style={styles.roomCard}>
                <View style={styles.roomCardContent}>
                  <MessageCircle size={20} color={colors.primary} />
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>{item.name}</Text>
                    <Text style={styles.roomParticipants}>
                      {item.participantCount} participant
                      {item.participantCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Badge
                    text={String(item.participantCount)}
                    variant="info"
                  />
                </View>
              </Card>
            </Pressable>
          )}
          contentContainerStyle={styles.roomList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <WifiOff size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No active rooms</Text>
              <Text style={styles.emptyText}>
                Create a room above to start collaborating. Room discovery
                will be available once real-time services are online.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },

  // Beta banner
  betaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(59, 130, 246, 0.2)",
  },
  betaText: {
    flex: 1,
    color: colors.info,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },

  // Create section
  createSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  createRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  roomInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSize.base,
  },

  // Room list
  roomList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  roomCard: {
    gap: spacing.sm,
  },
  roomCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  roomInfo: {
    flex: 1,
    gap: 2,
  },
  roomName: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  roomParticipants: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
  },
});
