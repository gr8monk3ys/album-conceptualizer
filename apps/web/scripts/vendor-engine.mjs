// Copies the repo-root engine package next to the web app before a Vercel build,
// so the Python function in api/engine.py bundles it. A function can only ship
// files inside the project's Root Directory (apps/web): vercel.json's
// includeFiles rejects "..", and Vercel's requirements.txt parser can't install a
// path outside it either. Does nothing outside Vercel, where engine.py finds the
// package by walking up from itself.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.VERCEL) process.exit(0);

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(webDir, "..", "..", "album_conceptualizer");
const target = join(webDir, "album_conceptualizer");

if (!existsSync(join(source, "__init__.py"))) {
  console.error(`vendor-engine: no engine package at ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) => !path.includes("__pycache__") && !path.endsWith(".pyc"),
});
console.log("vendor-engine: copied album_conceptualizer into apps/web for the engine function");
