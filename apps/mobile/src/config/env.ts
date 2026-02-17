/**
 * Environment-based configuration.
 *
 * The active environment is determined by the EAS build channel:
 *   - `development` — local dev builds (default)
 *   - `preview`     — internal test builds
 *   - `production`  — App Store / Play Store builds
 *
 * Update the URLs below once your backend is deployed.
 */
import Constants from "expo-constants";

const ENV = {
  development: {
    apiUrl: "http://localhost:3000",
    wsUrl: "ws://localhost:3000",
  },
  preview: {
    // TODO: Replace with your preview deployment URL
    apiUrl: "https://your-app-preview.vercel.app",
    wsUrl: "wss://your-app-preview.vercel.app",
  },
  production: {
    // TODO: Replace with your production deployment URL
    apiUrl: "https://your-app.vercel.app",
    wsUrl: "wss://your-app.vercel.app",
  },
};

type EnvName = keyof typeof ENV;

const channel = (Constants.expoConfig?.extra?.eas?.channel ??
  "development") as EnvName;

export const config = ENV[channel] ?? ENV.development;
