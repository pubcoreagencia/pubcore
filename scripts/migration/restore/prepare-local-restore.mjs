#!/usr/bin/env node
import { backupDirForDocker, backupFileName, getBackupPath } from "./restore-config.mjs";

const backupPath = getBackupPath();
const backupDir = backupDirForDocker(backupPath);
const backupFile = backupFileName(backupPath);

const commands = [
  {
    step: "Validate archive list with Docker",
    command: `docker run --rm -v "${backupDir}:/backup:ro" postgres:latest pg_restore --list "/backup/${backupFile}"`,
  },
  {
    step: "Start disposable PostgreSQL container",
    command: "docker run --name pubcore-restore-test -e POSTGRES_PASSWORD=postgres -p 55432:5432 -d postgres:latest",
  },
  {
    step: "Restore backup into disposable database",
    command: `docker run --rm --network host -v "${backupDir}:/backup:ro" postgres:latest pg_restore --verbose --clean --if-exists --no-owner --no-privileges --dbname "postgresql://postgres:postgres@127.0.0.1:55432/postgres" "/backup/${backupFile}"`,
  },
  {
    step: "Count restored tables using existing helper",
    command: "$env:TARGET_DATABASE_URL = \"postgresql://postgres:postgres@127.0.0.1:55432/postgres\"; node scripts/migration/count-records.mjs target reports/restored-local-counts.json; Remove-Item Env:\\TARGET_DATABASE_URL",
  },
  {
    step: "Stop disposable PostgreSQL container",
    command: "docker rm -f pubcore-restore-test",
  },
];

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  backupPath,
  note: "Commands are printed only. Review before running manually.",
  commands,
}, null, 2));

