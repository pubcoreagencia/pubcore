import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function getDatabaseUrl(kind) {
  const normalized = String(kind || "").toLowerCase();
  const envName = normalized === "source" ? "SOURCE_DATABASE_URL" : normalized === "target" ? "TARGET_DATABASE_URL" : "DATABASE_URL";
  const value = process.env[envName] || (normalized ? "" : process.env.DATABASE_URL);
  if (!value) {
    throw new Error(`Missing ${envName}. Pass it only when you intentionally want to inspect that database.`);
  }
  return value;
}

export function runPsql(databaseUrl, sql) {
  const args = [databaseUrl, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", sql];
  const localPsql = spawnSync("psql", ["--version"], { encoding: "utf8", windowsHide: true });
  const useDocker = Boolean(localPsql.error && localPsql.error.code === "ENOENT" && process.env.MIGRATION_PSQL_DOCKER_CONTAINER);
  const result = useDocker
    ? spawnSync(
      "docker",
      ["exec", process.env.MIGRATION_PSQL_DOCKER_CONTAINER, "psql", ...args],
      { encoding: "utf8", windowsHide: true },
    )
    : spawnSync(
      "psql",
      args,
      { encoding: "utf8", windowsHide: true },
    );
  if (result.error) {
    if (localPsql.error?.code === "ENOENT" && !process.env.MIGRATION_PSQL_DOCKER_CONTAINER) {
      throw new Error("Failed to run psql. Local psql was not found. Install PostgreSQL client or set MIGRATION_PSQL_DOCKER_CONTAINER to a running postgres container.");
    }
    throw new Error(`Failed to run ${useDocker ? "docker exec psql" : "psql"}. ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${useDocker ? "docker exec psql" : "psql"} failed`).trim());
  }
  return result.stdout.trim();
}

export function writeJson(filePath, data) {
  const absolute = resolve(filePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(data, null, 2)}\n`);
  return absolute;
}

export function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function relation(schema, table) {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}
