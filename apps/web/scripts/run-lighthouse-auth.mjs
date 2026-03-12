#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = (
  process.env.LIGHTHOUSE_BASE_URL ??
  process.env.ALBUM_CONCEPTUALIZER_WEB_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3301"
).replace(/\/+$/, "");

const route = process.env.LIGHTHOUSE_AUTH_ROUTE ?? "/app/settings";
const preset = process.env.LIGHTHOUSE_PRESET ?? "desktop";
const reportDir = path.resolve(
  process.env.LIGHTHOUSE_REPORT_DIR ?? path.join("output", "lighthouse", "auth"),
);

const requiredCategories = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best Practices"],
  ["seo", "SEO"],
];

function runLighthouse(url, outputPath, profileDir) {
  execFileSync(
    "npx",
    [
      "-y",
      "lighthouse",
      url,
      `--preset=${preset}`,
      "--output=json",
      `--output-path=${outputPath}`,
      "--quiet",
      `--chrome-flags=--headless=new --no-sandbox --user-data-dir=${profileDir}`,
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
}

function getCategoryScore(report, id) {
  const score = report.categories?.[id]?.score;
  return typeof score === "number" ? Math.round(score * 100) : 0;
}

async function signInWithDevLogin(profileDir) {
  const context = await chromium.launchPersistentContext(profileDir, { headless: true });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${baseURL}/sign-in`, { waitUntil: "networkidle" });

    const devLoginButton = page.getByRole("button", { name: /continue \(dev\)/i });
    const isDevLoginVisible = await devLoginButton.isVisible().catch(() => false);

    if (!isDevLoginVisible) {
      throw new Error(
        "Dev login is not available. Set ENABLE_DEV_LOGIN=1 and NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 for the authenticated Lighthouse audit.",
      );
    }

    await devLoginButton.click();
    await page.waitForURL("**/app", { timeout: 15_000 });
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
  } finally {
    await context.close();
  }
}

mkdirSync(reportDir, { recursive: true });

const profileDir = mkdtempSync(path.join(tmpdir(), "ac-lighthouse-auth-profile-"));
const scratchDir = mkdtempSync(path.join(tmpdir(), "ac-lighthouse-auth-"));
const failures = [];

try {
  await signInWithDevLogin(profileDir);

  const url = `${baseURL}${route}`;
  const scratchPath = path.join(scratchDir, "auth.json");
  const finalPath = path.join(reportDir, "settings.report.json");

  console.log(`[lighthouse] auditing authenticated route ${url}`);
  runLighthouse(url, scratchPath, profileDir);

  const report = JSON.parse(readFileSync(scratchPath, "utf8"));
  cpSync(scratchPath, finalPath);

  const rendered = requiredCategories
    .map(([id, label]) => `${label} ${getCategoryScore(report, id)}`)
    .join(" | ");
  console.log(`[lighthouse] ${route} -> ${rendered}`);

  for (const [id, label] of requiredCategories) {
    const score = getCategoryScore(report, id);
    if (score !== 100) {
      failures.push({ route, label, score, url });
    }
  }
} finally {
  rmSync(profileDir, { recursive: true, force: true });
  rmSync(scratchDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("[lighthouse] authenticated route audit failed:");
  for (const failure of failures) {
    console.error(
      `  - ${failure.route}: ${failure.label} expected 100, found ${failure.score} (${failure.url})`,
    );
  }
  process.exit(1);
}

console.log(`[lighthouse] authenticated route passed with 100/100 scores. Reports: ${reportDir}`);
