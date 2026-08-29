import { defineConfig } from "prisma/config";

const DEFAULT_DB_SCHEMA = "album_conceptualizer";

function withSchemaParam(connectionString: string, schema: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.set("schema", schema);
    return url.toString();
  } catch {
    const separator = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${separator}schema=${encodeURIComponent(schema)}`;
  }
}

// Prisma v7 loads datasource configuration from `prisma.config.ts`.
// We use a safe, non-secret fallback so `prisma generate` works even if a local
// `DATABASE_URL` isn't set yet (it doesn't connect during generation).
const baseDatabaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://postgres:postgres@localhost:5433/album_conceptualizer?schema=${DEFAULT_DB_SCHEMA}`;
const configuredSchema = process.env.PRISMA_DB_SCHEMA?.trim() || DEFAULT_DB_SCHEMA;
const DATABASE_URL =
  configuredSchema && configuredSchema.length > 0
    ? withSchemaParam(baseDatabaseUrl, configuredSchema)
    : baseDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: DATABASE_URL,
  },
});
