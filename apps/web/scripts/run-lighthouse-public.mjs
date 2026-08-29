#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const baseURL = (
  process.env.LIGHTHOUSE_BASE_URL ??
  process.env.ALBUM_CONCEPTUALIZER_WEB_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3300"
).replace(/\/+$/, "");

const reportDir = path.resolve(
  process.env.LIGHTHOUSE_REPORT_DIR ?? path.join("output", "lighthouse", "public"),
);

const requiredCategories = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best Practices"],
  ["seo", "SEO"],
];

const routes = [
  { label: "home", path: "/" },
  { label: "sign-in", path: "/sign-in" },
];

function runLighthouse(url, outputPath, profileDir) {
  execFileSync(
    "npx",
    [
      "-y",
      "lighthouse",
      url,
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

mkdirSync(reportDir, { recursive: true });

const profileDir = mkdtempSync(path.join(tmpdir(), "ac-lighthouse-public-profile-"));
const scratchDir = mkdtempSync(path.join(tmpdir(), "ac-lighthouse-public-"));
const failures = [];
const summaries = [];

try {
  for (const route of routes) {
    const url = `${baseURL}${route.path === "/" ? "/" : route.path}`;
    const scratchPath = path.join(scratchDir, `${route.label}.json`);
    const finalPath = path.join(reportDir, `${route.label}.report.json`);

    console.log(`[lighthouse] auditing ${url}`);
    runLighthouse(url, scratchPath, profileDir);

    const report = JSON.parse(readFileSync(scratchPath, "utf8"));
    cpSync(scratchPath, finalPath);

    const scores = Object.fromEntries(
      requiredCategories.map(([id, label]) => [label, getCategoryScore(report, id)]),
    );
    summaries.push({ route: route.path, scores });

    for (const [id, label] of requiredCategories) {
      const score = getCategoryScore(report, id);
      if (score !== 100) {
        failures.push({ route: route.path, label, score, url });
      }
    }
  }
} finally {
  rmSync(profileDir, { recursive: true, force: true });
  rmSync(scratchDir, { recursive: true, force: true });
}

for (const summary of summaries) {
  const rendered = requiredCategories
    .map(([, label]) => `${label} ${summary.scores[label]}`)
    .join(" | ");
  console.log(`[lighthouse] ${summary.route} -> ${rendered}`);
}

if (failures.length > 0) {
  console.error("[lighthouse] public route audit failed:");
  for (const failure of failures) {
    console.error(
      `  - ${failure.route}: ${failure.label} expected 100, found ${failure.score} (${failure.url})`,
    );
  }
  process.exit(1);
}

console.log(`[lighthouse] public routes passed with 100/100 scores. Reports: ${reportDir}`);
