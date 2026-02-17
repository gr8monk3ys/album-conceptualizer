import { Stack } from "expo-router";
import type { ReactNode } from "react";

import { colors } from "../../src/theme";

export default function SettingsLayout(): ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Settings", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="billing"
        options={{ title: "Billing", headerBackTitle: "Settings" }}
      />
    </Stack>
  );
}
