#!/usr/bin/env node
import { parseToc, readToc } from "./restore-config.mjs";

const format = process.argv.includes("--json") ? "json" : "text";
const { text } = readToc();
const { entries } = parseToc(text);
const tableData = entries
  .filter((entry) => entry.section === "TABLE DATA")
  .map((entry) => ({
    schema: entry.schema,
    table: entry.name,
    relation: `${entry.schema}.${entry.name}`,
    owner: entry.owner,
    tocId: entry.tocId,
  }))
  .sort((a, b) => a.relation.localeCompare(b.relation));

if (format === "json") {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), tableData }, null, 2));
} else {
  for (const entry of tableData) {
    console.log(`${entry.relation}`);
  }
}

