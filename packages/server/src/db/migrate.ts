import { migrateConfiguredDatabase } from "./migration-workflow.js";

async function main(): Promise<void> {
  const result = await migrateConfiguredDatabase(process.env);

  if (result.appliedBaselineMigrations.length === 0) {
    console.log(
      `No pending baseline SQL migrations for ${result.mode}/${result.provider}. Drizzle migrations folder: ${result.drizzleMigrationsDir}`,
    );
    return;
  }

  console.log(
    `Applied baseline SQL migrations for ${result.mode}/${result.provider}: ${result.appliedBaselineMigrations.join(", ")}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
