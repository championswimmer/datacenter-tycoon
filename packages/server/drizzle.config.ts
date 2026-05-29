import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/relations.ts"],
  out: "./drizzle",
  // Historical baseline note:
  // - packages/server/migrations/001_leaderboard_foundation.sql remains the pre-Drizzle bootstrap migration.
  // - New Drizzle-generated migrations will live under ./drizzle so we can adopt Drizzle incrementally
  //   without overwriting the existing SQL migration ledger yet.
});
