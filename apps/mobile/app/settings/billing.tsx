import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Check,
  CreditCard,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { Badge, Button, Card, Loading } from "../../src/components/ui";
import { billingApi } from "../../src/api/billing";
import type { Subscription } from "../../src/api/types";
import {
  borderRadius,
  colors,
  fontSize,
  spacing,
} from "../../src/theme";

// ── Plan data ────────────────────────────────────────────────────────

interface PlanDef {
  key: Subscription["plan"];
  name: string;
  features: string[];
  price: string;
  badgeVariant: "default" | "info" | "success";
}

const PLANS: PlanDef[] = [
  {
    key: "free",
    name: "FREE",
    price: "$0/mo",
    badgeVariant: "default",
    features: [
      "5 albums",
      "Basic export (JSON, Markdown)",
      "50 credits/month",
      "Community support",
    ],
  },
  {
    key: "pro",
    name: "PRO",
    price: "$12/mo",
    badgeVariant: "info",
    features: [
      "Unlimited albums",
      "All export formats",
      "Audio generation",
      "500 credits/month",
      "Priority support",
    ],
  },
  {
    key: "team",
    name: "TEAM",
    price: "$29/mo",
    badgeVariant: "success",
    features: [
      "Everything in Pro",
      "Workspaces & team roles",
      "Real-time collaboration",
      "2,000 credits/month",
      "Dedicated support",
    ],
  },
];

// ── Feature row ──────────────────────────────────────────────────────

interface FeatureRowProps {
  text: string;
}

function FeatureRow({ text }: FeatureRowProps): ReactNode {
  return (
    <View style={styles.featureRow}>
      <Check size={14} color={colors.success} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ── Plan card ────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanDef;
  isCurrent: boolean;
  onUpgrade: () => void;
  upgrading: boolean;
}

function PlanCard({
  plan,
  isCurrent,
  onUpgrade,
  upgrading,
}: PlanCardProps): ReactNode {
  return (
    <Card
      style={[
        styles.planCard,
        isCurrent ? styles.planCardCurrent : undefined,
      ]}
    >
      <View style={styles.planCardHeader}>
        <View style={styles.planNameRow}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Badge text={plan.price} variant={plan.badgeVariant} />
        </View>
        {isCurrent && <Badge text="Current Plan" variant="success" />}
      </View>
      <View style={styles.featureList}>
        {plan.features.map((feature) => (
          <FeatureRow key={feature} text={feature} />
        ))}
      </View>
      {!isCurrent && (
        <Button
          title={`Upgrade to ${plan.name}`}
          onPress={onUpgrade}
          variant="primary"
          size="sm"
          loading={upgrading}
          icon={<Zap size={16} color={colors.white} />}
        />
      )}
    </Card>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function BillingScreen(): ReactNode {
  const router = useRouter();
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const {
    data: subscription,
    isLoading: subLoading,
  } = useQuery({
    queryKey: ["subscription"],
    queryFn: billingApi.getSubscription,
  });

  const {
    data: credits,
    isLoading: creditsLoading,
  } = useQuery({
    queryKey: ["credits"],
    queryFn: billingApi.getCredits,
  });

  const currentPlan = subscription?.plan ?? "free";

  const handleUpgrade = useCallback(
    async (plan: string) => {
      setUpgradingPlan(plan);
      try {
        const { url } = await billingApi.createCheckout(plan);
        await Linking.openURL(url);
      } catch {
        Alert.alert("Error", "Failed to start checkout. Please try again.");
      } finally {
        setUpgradingPlan(null);
      }
    },
    [],
  );

  const handleManageBilling = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.getPortalUrl();
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Failed to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }, []);

  if (subLoading || creditsLoading) {
    return <Loading />;
  }

  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Current plan summary */}
        <View style={styles.section}>
          <Card style={styles.currentPlanCard}>
            <View style={styles.currentPlanHeader}>
              <CreditCard size={24} color={colors.primary} />
              <View style={styles.currentPlanInfo}>
                <Text style={styles.currentPlanLabel}>Current Plan</Text>
                <Badge
                  text={currentPlan.toUpperCase()}
                  variant={
                    PLANS.find((p) => p.key === currentPlan)?.badgeVariant ??
                    "default"
                  }
                />
              </View>
            </View>
            <View style={styles.currentPlanDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Badge
                  text={subscription?.status === "active" ? "Active" : "Inactive"}
                  variant={
                    subscription?.status === "active" ? "success" : "warning"
                  }
                />
              </View>
              {renewalDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Renews</Text>
                  <Text style={styles.detailValue}>{renewalDate}</Text>
                </View>
              )}
            </View>
          </Card>
        </View>

        {/* Credit balance */}
        <View style={styles.section}>
          <Card style={styles.creditCard}>
            <View style={styles.creditRow}>
              <Sparkles size={24} color={colors.warning} />
              <View style={styles.creditInfo}>
                <Text style={styles.creditLabel}>Credit Balance</Text>
                <Text style={styles.creditValue}>
                  {credits?.balance ?? 0} credits
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Plan comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plans</Text>
          <View style={styles.planList}>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === currentPlan}
                onUpgrade={() => handleUpgrade(plan.key)}
                upgrading={upgradingPlan === plan.key}
              />
            ))}
          </View>
        </View>

        {/* Manage billing */}
        {currentPlan !== "free" && (
          <View style={styles.section}>
            <Button
              title="Manage Billing"
              onPress={handleManageBilling}
              variant="secondary"
              loading={portalLoading}
              icon={<ExternalLink size={18} color={colors.text} />}
            />
          </View>
        )}
      </ScrollView>
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
    paddingBottom: spacing["3xl"],
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Current plan
  currentPlanCard: {
    gap: spacing.lg,
  },
  currentPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  currentPlanInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currentPlanLabel: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  currentPlanDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },

  // Credits
  creditCard: {
    gap: spacing.sm,
  },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  creditInfo: {
    flex: 1,
    gap: 2,
  },
  creditLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  creditValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },

  // Plan list
  planList: {
    gap: spacing.md,
  },
  planCard: {
    gap: spacing.md,
  },
  planCardCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  planCardHeader: {
    gap: spacing.sm,
  },
  planNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  featureList: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  featureText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    flex: 1,
  },
});
