#!/usr/bin/env node
import { readFileSync } from "node:fs";

const [backupSourceCountsFile, restoredOrTargetCountsFile] = process.argv.slice(2);

if (!backupSourceCountsFile || !restoredOrTargetCountsFile) {
  console.error("Usage: node scripts/migration/restore/compare-after-restore.mjs <source-counts.json> <restored-or-target-counts.json>");
  process.exit(1);
}

const source = JSON.parse(readFileSync(backupSourceCountsFile, "utf8"));
const restored = JSON.parse(readFileSync(restoredOrTargetCountsFile, "utf8"));
const sourceMap = new Map(source.counts.map((item) => [item.table, Number(item.count)]));
const restoredMap = new Map(restored.counts.map((item) => [item.table, Number(item.count)]));
const tables = [...new Set([...sourceMap.keys(), ...restoredMap.keys()])].sort();
const comparison = tables.map((table) => {
  const sourceCount = sourceMap.get(table) ?? 0;
  const restoredCount = restoredMap.get(table) ?? 0;
  return {
    table,
    source: sourceCount,
    restoredOrTarget: restoredCount,
    delta: restoredCount - sourceCount,
    ok: sourceCount === restoredCount,
  };
});
const mismatches = comparison.filter((entry) => !entry.ok);

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  ok: mismatches.length === 0,
  mismatches,
  comparison,
}, null, 2));

if (mismatches.length > 0) {
  process.exitCode = 2;
}

