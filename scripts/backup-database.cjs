const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const backupDir = process.env.BACKUP_DIR || "backups";
mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputFile = join(backupDir, `scadacom-db-${timestamp}.dump`);

const result = spawnSync(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-privileges", "--file", outputFile, databaseUrl],
  { stdio: "inherit" }
);

if (result.error) {
  console.error(`Could not run pg_dump: ${result.error.message}`);
  console.error("Install PostgreSQL client tools or add pg_dump to PATH.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error("Database backup failed.");
  process.exit(result.status || 1);
}

console.log(`Database backup created: ${outputFile}`);
