import { Tabs } from "expo-router";
import { Bell, Compass, Home, Library, PlusCircle } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import type { ReactNode } from "react";

import { ErrorBoundary } from "../../src/components/ui";
import { MiniPlayer } from "../../src/components/player/mini-player";
import { useUnreadCount } from "../../src/hooks/use-notifications";
import { usePlayerStore } from "../../src/stores/player-store";
import { hapticSelection } from "../../src/utils/haptics";
import { colors, spacing } from "../../src/theme";

const TAB_BAR_ICON_SIZE = 24;
const CREATE_ICON_SIZE = 32;

function TabBarBadgeDot(): ReactNode {
  return <View style={styles.badgeDot} />;
}

export default function TabsLayout(): ReactNode {
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const unreadCount = useUnreadCount();
  const hasAudio = audioUrl !== null;

  return (
    <View style={styles.root}>
      <ErrorBoundary>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "600" },
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: styles.tabBarLabel,
          }}
          screenListeners={{
            tabPress: () => {
              hapticSelection();
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color }) => (
                <Home size={TAB_BAR_ICON_SIZE} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="library"
            options={{
              title: "Library",
              tabBarIcon: ({ color }) => (
                <Library size={TAB_BAR_ICON_SIZE} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="studio"
            options={{
              title: "Create",
              tabBarIcon: () => (
                <View style={styles.createButton}>
                  <PlusCircle
                    size={CREATE_ICON_SIZE}
                    color={colors.primary}
                    strokeWidth={2}
                  />
                </View>
              ),
              tabBarLabel: () => null,
            }}
          />

          <Tabs.Screen
            name="discover"
            options={{
              title: "Discover",
              tabBarIcon: ({ color }) => (
                <Compass size={TAB_BAR_ICON_SIZE} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="notifications"
            options={{
              title: "Notifications",
              tabBarIcon: ({ color }) => (
                <View>
                  <Bell size={TAB_BAR_ICON_SIZE} color={color} />
                  {unreadCount > 0 && <TabBarBadgeDot />}
                </View>
              ),
            }}
          />
        </Tabs>

        {hasAudio && (
          <Animated.View
            entering={SlideInDown.duration(300)}
            exiting={SlideOutDown.duration(300)}
            style={styles.miniPlayerContainer}
          >
            <MiniPlayer onExpand={() => {}} />
          </Animated.View>
        )}
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    height: 84,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  createButton: {
    marginTop: -8,
  },
  miniPlayerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 84,
    zIndex: 10,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
});
