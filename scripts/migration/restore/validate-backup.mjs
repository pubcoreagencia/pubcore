#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { getBackupPath, parseToc, readToc } from "./restore-config.mjs";

const backupPath = getBackupPath();
const backupExists = existsSync(backupPath);
const backupStat = backupExists ? statSync(backupPath) : null;

let toc = null;
try {
  toc = readToc();
} catch (error) {
  toc = { error: error instanceof Error ? error.message : String(error) };
}

const parsed = toc.text ? parseToc(toc.text) : { metadata: {}, entries: [] };
const tableData = parsed.entries.filter((entry) => entry.section === "TABLE DATA");
const schemas = [...new Set(parsed.entries.map((entry) => entry.schema))].sort();
const criticalTableData = [
  "auth.users",
  "auth.identities",
  "public.profiles",
  "public.workspaces",
  "public.workspace_members",
  "public.user_roles",
  "storage.buckets",
  "storage.objects",
];
const tableDataKeys = new Set(tableData.map((entry) => `${entry.schema}.${entry.name}`));

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  backupPath,
  backupExists,
  backupSizeBytes: backupStat?.size ?? null,
  tocPath: toc.tocPath || null,
  tocAvailable: Boolean(toc.text),
  tocError: toc.error || null,
  archiveMetadata: parsed.metadata,
  schemas,
  tableDataCount: tableData.length,
  criticalTableData: criticalTableData.map((name) => ({ name, present: tableDataKeys.has(name) })),
  warnings: [
    "storage.objects stores metadata only; physical bucket files still need a separate Storage copy unless confirmed otherwise.",
    "Do not restore directly into the new Supabase until a fresh backup/snapshot of the target exists.",
  ],
}, null, 2));

if (!backupExists || !toc.text || criticalTableData.some((name) => !tableDataKeys.has(name))) {
  process.exitCode = 2;
}

