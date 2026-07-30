#!/usr/bin/env node
import { readFileSync } from "node:fs";

const [sourceFile, targetFile] = process.argv.slice(2);

if (!sourceFile || !targetFile) {
  console.error("Usage: node scripts/migration/compare-counts.mjs <source-counts.json> <target-counts.json>");
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourceFile, "utf8"));
const target = JSON.parse(readFileSync(targetFile, "utf8"));
const sourceMap = new Map(source.counts.map((item) => [item.table, Number(item.count)]));
const targetMap = new Map(target.counts.map((item) => [item.table, Number(item.count)]));
const tables = [...new Set([...sourceMap.keys(), ...targetMap.keys()])].sort();

const comparison = tables.map((table) => {
  const sourceCount = sourceMap.get(table) ?? 0;
  const targetCount = targetMap.get(table) ?? 0;
  return {
    table,
    source: sourceCount,
    target: targetCount,
    delta: targetCount - sourceCount,
    ok: sourceCount === targetCount,
  };
});

const failed = comparison.filter((item) => !item.ok);
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt,
  targetGeneratedAt: target.generatedAt,
  ok: failed.length === 0,
  mismatches: failed,
  comparison,
}, null, 2));

if (failed.length > 0) {
  process.exitCode = 2;
}

