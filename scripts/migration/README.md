# PUB CORE migration scripts

These helpers are read-only. They do not dump data, restore data, delete rows, or copy Storage files by themselves.

Required local dependency:

- `psql` available in PATH.

Environment variables are intentionally explicit:

- `SOURCE_DATABASE_URL` for the old Lovable Supabase database.
- `TARGET_DATABASE_URL` for the new PUB CORE Supabase database.

Examples:

```bash
SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs source reports/source-counts.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs target reports/target-counts.json
node scripts/migration/compare-counts.mjs reports/source-counts.json reports/target-counts.json

SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs source reports/source-storage.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs target reports/target-storage.json

TARGET_DATABASE_URL="postgresql://..." node scripts/migration/detect-orphans.mjs target reports/target-orphans.json
```

