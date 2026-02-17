/** Auth layout — minimal stack with no tabs, used for unauthenticated screens. */
import { Stack } from "expo-router";

import { colors } from "../../src/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    >
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
