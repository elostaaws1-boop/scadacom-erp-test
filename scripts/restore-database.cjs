const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;
const backupFile = process.env.BACKUP_FILE || process.argv[2];

if (process.env.RESTORE_CONFIRM !== "RESTORE") {
  console.error("Restore blocked. Set RESTORE_CONFIRM=RESTORE to continue.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!backupFile || !existsSync(backupFile)) {
  console.error("Provide a valid backup file path with BACKUP_FILE or as the first argument.");
  process.exit(1);
}

const result = spawnSync(
  "pg_restore",
  ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", databaseUrl, backupFile],
  { stdio: "inherit" }
);

if (result.error) {
  console.error(`Could not run pg_restore: ${result.error.message}`);
  console.error("Install PostgreSQL client tools or add pg_restore to PATH.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error("Database restore failed.");
  process.exit(result.status || 1);
}

console.log("Database restore completed.");
