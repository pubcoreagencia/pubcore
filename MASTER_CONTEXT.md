# PUB CORE MASTER CONTEXT

**Canonical repository:** `pubcoreagencia/pubcore`
**Canonical identity:** PUB Core
**Canonical branch:** `main`
**Status:** CANONICAL / ACTIVE

## Authority model

This repository is the canonical code repository for the PUB Core platform. Historical aliases such as `PUB-CORE`, `pub-core-os`, and `pub-co` must not be treated as independent implementations of the same core product.

- **GitHub:** versioned source of truth for code, architecture, migrations, documentation, and repository state.
- **Supabase/PostgreSQL:** source of truth for live runtime/database state.
- **PUB Master Context:** institutional context and cross-project governance.
- **PUB Neural:** ingestion, retrieval, evidence preservation, and autonomous knowledge layer.
- **PDL:** orchestration/governance layer that delegates execution to agents.

## Current verified database state

Current active Supabase project: `ytnmxzzjevdshpbryfyv`.
PostgreSQL: `17.6`.

Verified current counts:
- workspaces: 1
- checklist_companies: 1
- checklist_daily_completions: 1
- checklist_tasks: 1
- kanban_funnels: 2
- kanban_columns: 6
- kanban_cards: 2
- kanban_attachments: 0
- kanban_card_links: 0
- kanban_cards_archive: 0
- calendar_events: 0
- completion_reports: 0
- notes: 0
- ponto_sessions: 1
- shared_items: 0
- sticky_notes: 0

Historical datasets are provenance evidence and are not interchangeable with the current active database. In particular, the historical PUB CORE audit recorded `kanban_cards = 244`, while the current verified project records `kanban_cards = 2`.

## Repository unification rule

The repository `pubcore` is the canonical destination for PUB Core platform code. The repositories below are legacy aliases/placeholders and should not receive new PUB Core platform development:

- `pubcoreagencia/PUB-CORE` → empty placeholder
- `pubcoreagencia/pub-core-os` → minimal placeholder with a separate project master context
- `pubcoreagencia/pub-co` → minimal placeholder for the institutional portal concept

They are preserved as historical GitHub identities until repository-level archival/deletion is explicitly performed. Their contents must not be treated as competing sources of truth.

## Development rule

New PUB Core code, schema, migrations, operational documentation, and canonical architectural decisions go to `pubcoreagencia/pubcore`.

Do not duplicate a feature between aliases. Before creating a new repository, search the organization for an existing canonical implementation.

## Relationship to the institutional Master Context

The broader institutional `PUBMASTERMEGABLASTERCONTEXT.md` remains the authoritative holding-level context. This repository-level `MASTER_CONTEXT.md` is the canonical PUB Core project context and must remain aligned with it.

## Operating principle

**Git registra a verdade versionada. Banco prova o estado de execução. Master Context consolida o conhecimento. PUB Neural preserva e recupera a evidência. PDL governa a execução.**
