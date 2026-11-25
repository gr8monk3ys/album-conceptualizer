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
  // ws (the Neon driver's WebSocket in src/server/db.ts) must load from node_modules, not the
  // webpack bundle: bundled, its optional `bufferutil` require resolves to an empty module and
  // every frame of 48+ bytes throws "b.mask is not a function", dropping the DB connection.
  serverExternalPackages: ["ws"],
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) config.plugins.push(new CompileHintsPlugin());
    return config;
  },
  // The Python engine is served from this same Vercel project as the function
  // api/engine.py, under /engine on this origin (ENGINE_API_URL can then be
  // https://<host>/engine/api/v1). In local dev the same path is proxied to uvicorn
  // on :8000. beforeFiles: checked before pages, so no page can shadow it.
  async rewrites() {
    const dev = process.env.NODE_ENV === "development";
    const devOrigin = process.env.ENGINE_DEV_ORIGIN ?? "http://127.0.0.1:8000";
    return {
      beforeFiles: [
        { source: "/engine", destination: dev ? `${devOrigin}/` : "/api/engine" },
        { source: "/engine/:path*", destination: dev ? `${devOrigin}/:path*` : "/api/engine" },
      ],
    };
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
