import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// The parts of webpack's API the plugin uses (Next.js bundles webpack without its types).
type Source = object;
type Compilation = {
  chunks: Iterable<{ canBeInitial(): boolean; files: Iterable<string> }>;
  updateAsset(file: string, update: (source: Source) => Source): void;
  hooks: { processAssets: { tap(options: { name: string; stage: number }, run: () => void): void } };
};
type WebpackCompiler = {
  webpack: {
    Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE: number };
    sources: { ConcatSource: new (...parts: Array<string | Source>) => Source };
  };
  hooks: { thisCompilation: { tap(name: string, run: (compilation: Compilation) => void): void } };
};

/**
 * Marks every script a page loads at start-up (React, the Next.js runtime, the shared, layout
 * and page chunks) with V8's explicit compile hint, `//# allFunctionsCalledOnLoad` on the
 * first line (https://v8.dev/blog/explicit-compile-hints). Chromium then compiles those
 * functions on the background thread that streams the script in, instead of one by one on
 * the main thread the first time each runs. Nearly all of them run while the page starts,
 * and that lazy compiling was about half of the one long task before a page answers input
 * (roughly 130ms of it at 4x CPU throttling). Chunks loaded on demand (the player's
 * synthesizer, for one) are left alone. Other engines read the line as a comment.
 */
class CompileHintsPlugin {
  apply(compiler: WebpackCompiler) {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap("CompileHintsPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        // After minification, which would strip the comment.
        { name: "CompileHintsPlugin", stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1 },
        () => {
          for (const chunk of compilation.chunks) {
            if (!chunk.canBeInitial()) continue;
            for (const file of chunk.files) {
              if (!file.endsWith(".js")) continue;
              compilation.updateAsset(
                file,
                (source) => new sources.ConcatSource("//# allFunctionsCalledOnLoad\n", source),
              );
            }
          }
        },
      );
    });
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid picking up lockfiles outside this app when the repo is used as a workspace.
    root: currentDir,
  },
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) config.plugins.push(new CompileHintsPlugin());
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
