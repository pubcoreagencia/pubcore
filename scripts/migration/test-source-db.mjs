#!/usr/bin/env node
import { getDatabaseUrl, runPsql } from "./lib.mjs";

function redactDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = "****";
    if (url.username) url.username = "****";
    return url.toString();
  } catch {
    return "<redacted database url>";
  }
}

const sql = `
select jsonb_build_object(
  'connected', true,
  'currentDatabase', current_database(),
  'currentUser', current_user,
  'hasAuthUsers', to_regclass('auth.users') is not null,
  'hasPublicProfiles', to_regclass('public.profiles') is not null,
  'hasStorageObjects', to_regclass('storage.objects') is not null,
  'publicTableCount', (
    select count(*)::int
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  )
)::text;
`;

try {
  const databaseUrl = getDatabaseUrl("source");
  const result = JSON.parse(runPsql(databaseUrl, sql));
  console.log(JSON.stringify({
    source: "database",
    databaseUrl: redactDatabaseUrl(databaseUrl),
    checkedAt: new Date().toISOString(),
    ...result,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    source: "database",
    connected: false,
    checkedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}

