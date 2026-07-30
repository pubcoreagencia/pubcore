#!/usr/bin/env node
import { allCountTargets } from "./migration-config.mjs";
import { getDatabaseUrl, relation, runPsql, writeJson } from "./lib.mjs";

const kind = process.argv[2];
const output = process.argv[3];

if (!["source", "target"].includes(kind)) {
  console.error("Usage: node scripts/migration/count-records.mjs <source|target> [output.json]");
  process.exit(1);
}

const unionSql = allCountTargets
  .map((item) => {
    const key = `${item.schema}.${item.table}`;
    return `select '${key}' as table_name, count(*)::bigint as row_count from ${relation(item.schema, item.table)}`;
  })
  .join("\nunion all\n");

const sql = `
with counts as (
${unionSql}
)
select coalesce(jsonb_agg(jsonb_build_object(
  'table', table_name,
  'count', row_count
) order by table_name), '[]'::jsonb)::text
from counts;
`;

const databaseUrl = getDatabaseUrl(kind);
const parsed = JSON.parse(runPsql(databaseUrl, sql));
const report = {
  kind,
  generatedAt: new Date().toISOString(),
  projectRef: kind === "source" ? "owimmytcffoovmokbple" : "target",
  counts: parsed,
};

if (output) {
  const written = writeJson(output, report);
  console.log(`Wrote ${written}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}

