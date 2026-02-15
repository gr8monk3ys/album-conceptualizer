import { defineConfig } from "prisma/config";

// Prisma v7 loads datasource configuration from `prisma.config.ts`.
// We use a safe, non-secret fallback so `prisma generate` works even if a local
// `DATABASE_URL` isn't set yet (it doesn't connect during generation).
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/album_conceptualizer?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: DATABASE_URL,
  },
});
