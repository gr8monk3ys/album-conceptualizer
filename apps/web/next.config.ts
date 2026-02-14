import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid picking up lockfiles outside this app when the repo is used as a workspace.
    root: currentDir,
  },
};

export default nextConfig;
