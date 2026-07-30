#!/usr/bin/env node
import { parseToc, readToc } from "./restore-config.mjs";

const { tocPath, text } = readToc();
const { metadata, entries } = parseToc(text);
const schemas = {};

for (const entry of entries) {
  if (!schemas[entry.schema]) schemas[entry.schema] = { tables: [], tableData: [], otherEntries: 0 };
  if (entry.section === "TABLE") schemas[entry.schema].tables.push(entry.name);
  else if (entry.section === "TABLE DATA") schemas[entry.schema].tableData.push(entry.name);
  else schemas[entry.schema].otherEntries += 1;
}

for (const value of Object.values(schemas)) {
  value.tables = [...new Set(value.tables)].sort();
  value.tableData = [...new Set(value.tableData)].sort();
}

console.log(JSON.stringify({
  tocPath,
  generatedAt: new Date().toISOString(),
  archiveMetadata: metadata,
  schemas,
}, null, 2));

