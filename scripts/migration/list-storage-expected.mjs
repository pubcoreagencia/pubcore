#!/usr/bin/env node
import { getDatabaseUrl, runPsql, writeJson } from "./lib.mjs";

const kind = process.argv[2];
const output = process.argv[3];

if (!["source", "target"].includes(kind)) {
  console.error("Usage: node scripts/migration/list-storage-expected.mjs <source|target> [output.json]");
  process.exit(1);
}

const sql = `
with expected as (
  select 'files'::text as bucket_id, storage_path, 'files_items'::text as source_table, id::text as source_id
  from public.files_items
  where storage_path is not null
  union all
  select 'files'::text as bucket_id, storage_path, 'disco_versions'::text as source_table, id::text as source_id
  from public.disco_versions
  where storage_path is not null
  union all
  select 'kanban-attachments'::text as bucket_id, storage_path, 'kanban_attachments'::text as source_table, id::text as source_id
  from public.kanban_attachments
  where storage_path is not null
),
actual as (
  select bucket_id, name as storage_path, id::text as object_id, owner::text as owner
  from storage.objects
  where bucket_id in ('files', 'kanban-attachments')
)
select jsonb_build_object(
  'expected', coalesce((select jsonb_agg(to_jsonb(expected) order by bucket_id, storage_path) from expected), '[]'::jsonb),
  'actual', coalesce((select jsonb_agg(to_jsonb(actual) order by bucket_id, storage_path) from actual), '[]'::jsonb),
  'missingObjects', coalesce((
    select jsonb_agg(to_jsonb(e) order by e.bucket_id, e.storage_path)
    from expected e
    left join actual a on a.bucket_id = e.bucket_id and a.storage_path = e.storage_path
    where a.storage_path is null
  ), '[]'::jsonb),
  'orphanObjects', coalesce((
    select jsonb_agg(to_jsonb(a) order by a.bucket_id, a.storage_path)
    from actual a
    left join expected e on e.bucket_id = a.bucket_id and e.storage_path = a.storage_path
    where e.storage_path is null
  ), '[]'::jsonb)
)::text;
`;

const databaseUrl = getDatabaseUrl(kind);
const report = {
  kind,
  generatedAt: new Date().toISOString(),
  buckets: ["files", "kanban-attachments"],
  ...JSON.parse(runPsql(databaseUrl, sql)),
};

if (output) {
  const written = writeJson(output, report);
  console.log(`Wrote ${written}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}

