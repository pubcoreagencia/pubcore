# Restore helpers

Scripts in this directory are safe helpers for the Lovable Cloud backup at:

```text
C:\Users\lu\pubcore-migration-export\pubcore_260730.backup
```

They do not connect to the new Supabase and do not execute a real remote restore.

```powershell
node scripts/migration/restore/validate-backup.mjs
node scripts/migration/restore/list-backup-contents.mjs
node scripts/migration/restore/list-table-data.mjs
node scripts/migration/restore/list-table-data.mjs --json
node scripts/migration/restore/prepare-local-restore.mjs
```

Use `LOVABLE_BACKUP_PATH` and `LOVABLE_BACKUP_TOC` to point to another export without changing repository files.

