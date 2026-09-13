# PUB Repository Forensic Audit

**Date:** 2026-09-12
**Organization:** `pubcoreagencia`
**Scope:** consolidation clusters identified in the 53-repository inventory

## Executive result

GitHub remains the canonical source of truth. No repository was deleted or archived by this audit.

## Ecom

### Canonical
- `pub-ecom`

### Consolidated components
- `pubecomhub` -> `pub-ecom/apps/hub`
- `pub-ecom-catalog-worker` -> `pub-ecom/apps/catalog-worker`
- `pub-ecom-landing` -> `pub-ecom/apps/landing`

### Evidence
`pub-ecom/README.md` explicitly declares the monorepo consolidation. The blob SHA of `pub-ecom/apps/catalog-worker/package.json` is exactly the same as the standalone worker package (`2c82d1352f55c60161a09aa9ca74547f10df80a6`).

### Archive status
**BLOCKED.** The old worker and landing repositories are still receiving autonomous backup commits. Latest observed:
- worker: `e39fec0ae924ce27d8c2ba4e403b4f34f561bf88` at 2026-09-12 21:15 UTC
- landing: `e00c5bcb23d31ef37eaf4305a1c9917fcaa09736` at 2026-09-12 20:45 UTC
- canonical monorepo: `2ca4c096cb3da501520c880484dc712a8b7ffb64` at 2026-09-12 20:30 UTC

**Decision:** canonical boundary is confirmed, but archival requires proving the autonomous writer is snapshot-only and that deployments no longer point at the old repositories.

## Growth

### Production candidate
- `pubgrowth-ai-evolution`

### Legacy/related identity
- `pubgrowthai`

`pubgrowth-ai-evolution` documents a production Cloudflare Workers URL, Supabase project and Banco Inter PIX infrastructure. Its latest observed commit is `fa694c7a497e2b435f71c4e4f51f27abae255898` at 2026-09-12 20:45 UTC. `pubgrowthai` has independent history with latest observed commit `bb9de43062c1a418f539a1f0314935bb30b7dc58` at 2026-09-06 15:10 UTC.

**Decision:** do not archive `pubgrowthai` yet. Verify domain, deployment, database ownership and ancestry first.

## Neural

### Canonical
- `pub-neural`

### Legacy alias candidate
- `neural-os`

`pub-neural` contains the Git-canonical governance commit `f2783f9260c9f4c4e6a341384f489e03015f062b` and the verified current database-state evidence commit `5c1c0000c112c3322cdf24dee1fd444a49928739`.

`neural-os` is still receiving autonomous commits. Latest observed: `78ef58297611a95be985e194b0349419ba6ed98d` at 2026-09-12 21:15 UTC.

**Decision:** canonical identity is `pub-neural`; archive is blocked until autonomous targeting of `neural-os` is stopped or proven snapshot-only.

## Leads

### Canonical
- `pub-leads`

### Legacy identity
- `leadcore`

`pub-leads` is the current B2B SaaS implementation using Supabase Auth/Postgres/RLS and Turso/libSQL for prospecting data. `leadcore` retains the older LeadCore identity.

**Decision:** `pub-leads` is canonical. Clear deployment references before archive.

## Machine family

- `pub-machine`: base automation engine
- `pub-machine-saas`: external multi-tenant SaaS variant
- `pub-machine-2`: second-generation evolution/prototype

The READMEs explicitly describe different roles. Recent autonomous commits exist in `pub-machine` and `pub-machine-saas`.

**Decision:** keep the family intact for now. Do not merge by name. Evaluate ancestry and architecture before deciding whether `pub-machine-2` becomes the next-generation canonical engine.

## Immediate next forensic pass

1. Resolve autonomous writer targets so legacy repositories stop receiving ambiguous writes.
2. Compare Git ancestry for Growth, Neural, Leads and Machine.
3. Inspect deployment/domain references for all consolidation candidates.
4. Inspect database/schema ownership and unique assets.
5. Search cross-repository references before any archive operation.
6. Only then move candidates from `ARCHIVE BLOCKED` to `ARCHIVE APPROVED`.

**Rule:** never delete first and investigate later.
