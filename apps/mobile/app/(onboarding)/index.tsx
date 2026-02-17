/** Onboarding screen — swipeable intro pages shown on first launch. */
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Disc3, Download, Sparkles, Users } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { borderRadius, colors, fontSize, spacing } from "../../src/theme";

import type { LucideIcon } from "lucide-react-native";
import type { ListRenderItemInfo, ViewToken } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingPage {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const PAGES: OnboardingPage[] = [
  {
    key: "plan",
    title: "Plan Your Album",
    description:
      "Organize your concept album from start to finish. Define themes, characters, and narrative arcs that tie your music together.",
    icon: Disc3,
    color: colors.primary,
  },
  {
    key: "collab",
    title: "Collaborate in Real-time",
    description:
      "Invite collaborators, share ideas on a live board, and chat about your music in dedicated collab rooms.",
    icon: Users,
    color: colors.success,
  },
  {
    key: "export",
    title: "Export to Your DAW",
    description:
      "Export your album bible, chord charts, and lyric sheets as PDF or share them with your team.",
    icon: Download,
    color: colors.info,
  },
  {
    key: "start",
    title: "Get Started",
    description:
      "Create your first concept album and bring your creative vision to life.",
    icon: Sparkles,
    color: colors.warning,
  },
];

function PageItem({ item }: ListRenderItemInfo<OnboardingPage>) {
  const Icon = item.icon;

  return (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View
        style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}
      >
        <Icon size={64} color={item.color} />
      </View>
      <Text style={styles.pageTitle}>{item.title}</Text>
      <Text style={styles.pageDescription}>{item.description}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingPage>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const isLastPage = activeIndex === PAGES.length - 1;

  async function handleComplete(): Promise<void> {
    await SecureStore.setItemAsync("hasOnboarded", "true");
    router.replace("/(auth)/sign-in" as never);
  }

  function handleNext() {
    if (isLastPage) {
      handleComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    }
  }

  function handleSkip() {
    handleComplete();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Skip button */}
        <View style={styles.skipRow}>
          {!isLastPage && (
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Pages */}
        <FlatList
          ref={flatListRef}
          data={PAGES}
          renderItem={(info) => <PageItem {...info} />}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
        />

        {/* Dots indicator */}
        <View style={styles.dotsRow}>
          {PAGES.map((page, index) => (
            <View
              key={page.key}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Action button */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.actionText}>
              {isLastPage ? "Get Started" : "Next"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  skipRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    minHeight: 40,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  pageTitle: {
    color: colors.text,
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    textAlign: "center",
  },
  pageDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceBorder,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  actionRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
});
