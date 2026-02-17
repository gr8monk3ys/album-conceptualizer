import { useLocalSearchParams } from "expo-router";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Palette,
  Plus,
  User,
  Wand2,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Loading,
} from "../../../src/components/ui";
import { useAlbum } from "../../../src/hooks/use-albums";
import type {
  AlbumBible,
  BibleCharacter,
  BibleMotif,
  BibleStyleProfile,
  BibleTheme,
} from "../../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Segment control ──────────────────────────────────────────────────

type BibleTab = "themes" | "characters" | "motifs" | "style";

interface SegmentControlProps {
  activeTab: BibleTab;
  onTabChange: (tab: BibleTab) => void;
}

const TAB_OPTIONS: { key: BibleTab; label: string }[] = [
  { key: "themes", label: "Themes" },
  { key: "characters", label: "Characters" },
  { key: "motifs", label: "Motifs" },
  { key: "style", label: "Style" },
];

function SegmentControl({ activeTab, onTabChange }: SegmentControlProps): ReactNode {
  return (
    <View style={styles.segmentContainer}>
      {TAB_OPTIONS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={[styles.segmentItem, isActive && styles.segmentItemActive]}
          >
            <Text
              style={[
                styles.segmentText,
                isActive && styles.segmentTextActive,
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

// ── Expandable card wrapper ──────────────────────────────────────────

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  badge?: { text: string; variant?: "default" | "success" | "warning" | "error" | "info" };
  children: ReactNode;
}

function ExpandableCard({
  title,
  subtitle,
  badge,
  children,
}: ExpandableCardProps): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <Card>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.expandableHeader}
      >
        <View style={styles.expandableInfo}>
          <View style={styles.expandableTitleRow}>
            <Text style={styles.expandableTitle}>{title}</Text>
            {badge && <Badge text={badge.text} variant={badge.variant} />}
          </View>
          {subtitle && (
            <Text style={styles.expandableSubtitle} numberOfLines={expanded ? undefined : 2}>
              {subtitle}
            </Text>
          )}
        </View>
        <Icon size={20} color={colors.textMuted} />
      </Pressable>
      {expanded && <View style={styles.expandableBody}>{children}</View>}
    </Card>
  );
}

// ── Theme card ───────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: BibleTheme;
}

function ThemeCard({ theme }: ThemeCardProps): ReactNode {
  return (
    <ExpandableCard title={theme.name} subtitle={theme.description}>
      {theme.keywords.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Keywords</Text>
          <View style={styles.chipRow}>
            {theme.keywords.map((kw) => (
              <Chip key={kw} label={kw} />
            ))}
          </View>
        </View>
      )}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Valence: {theme.valence.toFixed(1)}</Text>
        <Text style={styles.metaText}>Arousal: {theme.arousal.toFixed(1)}</Text>
      </View>
      {theme.primary_songs.length > 0 && (
        <Text style={styles.metaText}>
          Primary songs: {theme.primary_songs.join(", ")}
        </Text>
      )}
    </ExpandableCard>
  );
}

// ── Character card ───────────────────────────────────────────────────

interface CharacterCardProps {
  character: BibleCharacter;
}

function CharacterCard({ character }: CharacterCardProps): ReactNode {
  return (
    <ExpandableCard
      title={character.name}
      subtitle={character.role}
      badge={
        character.associated_key
          ? { text: character.associated_key, variant: "info" }
          : undefined
      }
    >
      {character.traits.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Traits</Text>
          <View style={styles.chipRow}>
            {character.traits.map((trait) => (
              <Chip key={trait} label={trait} />
            ))}
          </View>
        </View>
      )}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Character Arc</Text>
        <Text style={styles.bodyText}>{character.arc}</Text>
      </View>
      {character.vocal_style && (
        <Text style={styles.metaText}>
          Vocal style: {character.vocal_style}
        </Text>
      )}
      {character.appearances.length > 0 && (
        <Text style={styles.metaText}>
          Appears in tracks: {character.appearances.join(", ")}
        </Text>
      )}
    </ExpandableCard>
  );
}

// ── Motif card ───────────────────────────────────────────────────────

type MotifBadgeVariant = "default" | "info" | "warning";

const MOTIF_TYPE_VARIANT: Record<string, MotifBadgeVariant> = {
  lyrical: "info",
  musical: "warning",
  rhythmic: "default",
};

interface MotifCardProps {
  motif: BibleMotif;
}

function MotifCard({ motif }: MotifCardProps): ReactNode {
  return (
    <ExpandableCard
      title={motif.name}
      subtitle={motif.evolution_notes}
      badge={{
        text: motif.type,
        variant: MOTIF_TYPE_VARIANT[motif.type] ?? "default",
      }}
    >
      {motif.chord_pattern.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Chord Pattern</Text>
          <View style={styles.chipRow}>
            {motif.chord_pattern.map((chord, i) => (
              <Chip key={`${chord}-${i}`} label={chord} />
            ))}
          </View>
        </View>
      )}
      {motif.key_phrases.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Key Phrases</Text>
          <View style={styles.chipRow}>
            {motif.key_phrases.map((phrase) => (
              <Chip key={phrase} label={phrase} />
            ))}
          </View>
        </View>
      )}
      {motif.imagery.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Imagery</Text>
          <View style={styles.chipRow}>
            {motif.imagery.map((img) => (
              <Chip key={img} label={img} />
            ))}
          </View>
        </View>
      )}
      {motif.melodic_contour && (
        <Text style={styles.metaText}>
          Melodic contour: {motif.melodic_contour}
        </Text>
      )}
    </ExpandableCard>
  );
}

// ── Style profile ────────────────────────────────────────────────────

interface StyleProfileViewProps {
  profiles: BibleStyleProfile[];
}

function StyleProfileView({ profiles }: StyleProfileViewProps): ReactNode {
  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={Palette}
        title="No Style Profile"
        description="Run Autotag to generate style profiles for your album."
      />
    );
  }

  return (
    <View style={styles.listContainer}>
      {profiles.map((profile) => (
        <Card key={profile.id} style={styles.styleCard}>
          <Text style={styles.styleGenre}>{profile.primary_genre}</Text>

          {profile.subgenres.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Subgenres</Text>
              <View style={styles.chipRow}>
                {profile.subgenres.map((sg) => (
                  <Chip key={sg} label={sg} />
                ))}
              </View>
            </View>
          )}

          {profile.era_influence && (
            <Text style={styles.metaText}>
              Era: {profile.era_influence}
            </Text>
          )}

          {profile.reference_artists.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Reference Artists</Text>
              <View style={styles.chipRow}>
                {profile.reference_artists.map((artist) => (
                  <Chip key={artist} label={artist} />
                ))}
              </View>
            </View>
          )}

          {profile.instrumentation.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Instrumentation</Text>
              <View style={styles.chipRow}>
                {profile.instrumentation.map((inst) => (
                  <Chip key={inst} label={inst} />
                ))}
              </View>
            </View>
          )}

          {profile.production_notes && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Production Notes</Text>
              <Text style={styles.bodyText}>{profile.production_notes}</Text>
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

// ── Add item modal ───────────────────────────────────────────────────

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  type: BibleTab;
}

function AddItemModal({ visible, onClose, type }: AddItemModalProps): ReactNode {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleAdd(): void {
    // Placeholder: in production this would call the API
    onClose();
    setName("");
    setDescription("");
  }

  const labelMap: Record<BibleTab, string> = {
    themes: "Theme",
    characters: "Character",
    motifs: "Motif",
    style: "Style Profile",
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add {labelMap[type]}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>

          <Input
            label="Name"
            placeholder={`${labelMap[type]} name`}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.modalSpacer} />

          <Input
            label="Description"
            placeholder="Description..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalSpacer} />

          <Button title={`Add ${labelMap[type]}`} onPress={handleAdd} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function BibleScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const { data: album, isLoading, error, refetch } = useAlbum(albumId);
  const [activeTab, setActiveTab] = useState<BibleTab>("themes");
  const [showAddModal, setShowAddModal] = useState(false);

  const bible: AlbumBible | null = useMemo(() => {
    if (!album?.data) return null;
    const data = album.data;
    // Construct bible from album data if available
    return {
      logline: data.concept_summary ?? "",
      synopsis: "",
      setting: "",
      themes: [] as BibleTheme[],
      characters: [] as BibleCharacter[],
      motifs: [] as BibleMotif[],
      style_profiles: [] as BibleStyleProfile[],
    };
  }, [album]);

  const handleAddItem = useCallback(() => {
    setShowAddModal(true);
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  function renderEmptyForTab(tab: BibleTab): ReactNode {
    const iconMap = { themes: Wand2, characters: User, motifs: BookOpen, style: Palette };
    const titleMap = {
      themes: "No Themes",
      characters: "No Characters",
      motifs: "No Motifs",
      style: "No Style Profiles",
    };
    const descMap = {
      themes: "Add themes to define your album's conceptual foundation.",
      characters: "Add characters that populate your album's narrative.",
      motifs: "Add recurring motifs that weave through your tracks.",
      style: "Run Autotag or manually define style profiles.",
    };

    return (
      <EmptyState
        icon={iconMap[tab]}
        title={titleMap[tab]}
        description={descMap[tab]}
        action={{ title: "Add", onPress: handleAddItem }}
      />
    );
  }

  function renderContent(): ReactNode {
    switch (activeTab) {
      case "themes": {
        const themes = bible?.themes ?? [];
        if (themes.length === 0) return renderEmptyForTab("themes");
        return (
          <View style={styles.listContainer}>
            {themes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </View>
        );
      }
      case "characters": {
        const characters = bible?.characters ?? [];
        if (characters.length === 0) return renderEmptyForTab("characters");
        return (
          <View style={styles.listContainer}>
            {characters.map((char) => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </View>
        );
      }
      case "motifs": {
        const motifs = bible?.motifs ?? [];
        if (motifs.length === 0) return renderEmptyForTab("motifs");
        return (
          <View style={styles.listContainer}>
            {motifs.map((motif) => (
              <MotifCard key={motif.id} motif={motif} />
            ))}
          </View>
        );
      }
      case "style": {
        const profiles = bible?.style_profiles ?? [];
        return <StyleProfileView profiles={profiles} />;
      }
      default:
        return null;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <SegmentControl activeTab={activeTab} onTabChange={setActiveTab} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {activeTab !== "style" && (
        <Pressable
          onPress={handleAddItem}
          style={({ pressed }) => [
            styles.fab,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Plus size={24} color={colors.white} />
        </Pressable>
      )}

      <AddItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        type={activeTab}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Segment control
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
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderRadius: borderRadius.md,
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

  // List container
  listContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  // Expandable card
  expandableHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  expandableInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  expandableTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  expandableTitle: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  expandableSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  expandableBody: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    gap: spacing.md,
  },

  // Fields
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // Style card
  styleCard: {
    gap: spacing.md,
  },
  styleGenre: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
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

  // Modal
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
  modalClose: {
    color: colors.primary,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  modalSpacer: {
    height: spacing.sm,
  },
});
