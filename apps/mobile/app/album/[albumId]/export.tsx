import { useLocalSearchParams } from "expo-router";
import {
  Archive,
  Check,
  Download,
  FileAudio,
  FileCode,
  FileJson,
  FileText,
  Music,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";

import { Button, Card, LoadingInline } from "../../../src/components/ui";
import { albumsApi } from "../../../src/api/albums";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../../src/theme";

// ── Format definitions ───────────────────────────────────────────────

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  extension: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "midi",
    name: "MIDI",
    description: "Standard MIDI file for DAW import",
    icon: Music,
    extension: ".mid",
  },
  {
    id: "chordpro",
    name: "ChordPro",
    description: "Lyrics with inline chord notation",
    icon: FileText,
    extension: ".cho",
  },
  {
    id: "musicxml",
    name: "MusicXML",
    description: "Universal notation interchange format",
    icon: FileCode,
    extension: ".musicxml",
  },
  {
    id: "json",
    name: "JSON",
    description: "Raw structured data export",
    icon: FileJson,
    extension: ".json",
  },
  {
    id: "pdf",
    name: "PDF",
    description: "Printable lead sheet with lyrics and chords",
    icon: FileText,
    extension: ".pdf",
  },
  {
    id: "markdown",
    name: "Markdown",
    description: "Human-readable text format",
    icon: FileText,
    extension: ".md",
  },
  {
    id: "zip",
    name: "Full Bundle",
    description: "ZIP archive with all formats included",
    icon: Archive,
    extension: ".zip",
  },
];

// ── Format card ──────────────────────────────────────────────────────

interface FormatCardProps {
  format: ExportFormat;
  isSelected: boolean;
  onPress: () => void;
}

function FormatCard({ format, isSelected, onPress }: FormatCardProps): ReactNode {
  const Icon = format.icon;

  return (
    <Card
      style={{
        ...styles.formatCard,
        ...(isSelected ? styles.formatCardSelected : undefined),
      }}
      onPress={onPress}
    >
      <View style={styles.formatRow}>
        <View
          style={[
            styles.formatIconContainer,
            isSelected && styles.formatIconContainerSelected,
          ]}
        >
          <Icon
            size={22}
            color={isSelected ? colors.white : colors.textSecondary}
          />
        </View>
        <View style={styles.formatInfo}>
          <View style={styles.formatNameRow}>
            <Text style={styles.formatName}>{format.name}</Text>
            <Text style={styles.formatExtension}>{format.extension}</Text>
          </View>
          <Text style={styles.formatDescription}>{format.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkCircle}>
            <Check size={16} color={colors.white} />
          </View>
        )}
      </View>
    </Card>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function ExportScreen(): ReactNode {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = useCallback(async () => {
    if (!selectedFormat) {
      Alert.alert("Select Format", "Please select an export format first.");
      return;
    }

    setExporting(true);
    setExportSuccess(false);

    try {
      await albumsApi.export(albumId, selectedFormat);
      setExportSuccess(true);
      Alert.alert("Export Complete", "Your file is ready to download.", [
        {
          text: "Share",
          onPress: () => {
            // In production: use expo-sharing to share the file
            Alert.alert("Share", "Sharing is handled via expo-sharing.");
          },
        },
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Export Failed", "Something went wrong. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [albumId, selectedFormat]);

  const selectedFormatInfo = EXPORT_FORMATS.find(
    (f) => f.id === selectedFormat,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Download size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>Export Album</Text>
          <Text style={styles.headerDescription}>
            Choose a format to export your album data. Select one and tap Export
            below.
          </Text>
        </View>

        {/* Format list */}
        <View style={styles.formatList}>
          {EXPORT_FORMATS.map((format) => (
            <FormatCard
              key={format.id}
              format={format}
              isSelected={selectedFormat === format.id}
              onPress={() => setSelectedFormat(format.id)}
            />
          ))}
        </View>

        {/* Selected format summary */}
        {selectedFormatInfo && (
          <View style={styles.selectedSummary}>
            <Text style={styles.summaryText}>
              Exporting as{" "}
              <Text style={styles.summaryBold}>{selectedFormatInfo.name}</Text>{" "}
              ({selectedFormatInfo.extension})
            </Text>
          </View>
        )}

        {/* Loading state */}
        {exporting && (
          <View style={styles.loadingContainer}>
            <LoadingInline />
            <Text style={styles.loadingText}>Generating export...</Text>
          </View>
        )}

        {/* Success state */}
        {exportSuccess && !exporting && (
          <View style={styles.successContainer}>
            <Check size={20} color={colors.success} />
            <Text style={styles.successText}>Export ready!</Text>
          </View>
        )}
      </ScrollView>

      {/* Export button */}
      <View style={styles.footer}>
        <Button
          title="Export"
          onPress={handleExport}
          loading={exporting}
          disabled={!selectedFormat}
          icon={<FileAudio size={18} color={colors.white} />}
        />
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
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  headerDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },

  // Format list
  formatList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  formatCard: {
    padding: spacing.md,
  },
  formatCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  formatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  formatIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  formatIconContainerSelected: {
    backgroundColor: colors.primary,
  },
  formatInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  formatNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  formatName: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  formatExtension: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  formatDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Selected summary
  selectedSummary: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  summaryBold: {
    color: colors.text,
    fontWeight: "600",
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // Success
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  successText: {
    color: colors.success,
    fontSize: fontSize.base,
    fontWeight: "600",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
