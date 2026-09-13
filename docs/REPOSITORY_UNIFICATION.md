# PUB Repository Unification

**Decision:** PUB Core platform canonical repository = `pubcoreagencia/pubcore`.

## Audit result

The organization contains several similarly named repositories, but they are not all equivalent:

| Repository | Observed state | Classification | Canonical action |
|---|---|---|---|
| `pubcoreagencia/pubcore` | ~3861 KB, active application | **CANONICAL** | Continue development here |
| `pubcoreagencia/PUB-CORE` | Empty repository | **ALIAS / PLACEHOLDER** | No new development |
| `pubcoreagencia/pub-core-os` | ~1 KB, README + small MASTER_CONTEXT | **LEGACY PLACEHOLDER** | No new development |
| `pubcoreagencia/pub-co` | ~1 KB, README + small MASTER_CONTEXT | **LEGACY PLACEHOLDER** | No new development |

## Important distinction

`pubcore` is the actual platform implementation. `pub-core-os` describes an institutional operating-system concept, while `pub-co` describes an institutional/global portal concept. They are not evidence of independent production implementations of the current PUB Core application.

The repositories are therefore being **logically unified**, not blindly merged byte-for-byte. Existing histories are preserved. The canonical implementation is consolidated under `pubcore`.

## Master Context policy

There are three context layers:

1. **Institutional:** `PUBMASTERMEGABLASTERCONTEXT.md`, covering PUB Core Holding as a whole.
2. **Project:** `pubcore/MASTER_CONTEXT.md`, covering the PUB Core platform.
3. **Neural evidence:** `pub-neural/docs/PUBCORE_DATABASE_CURRENT_STATE_2026-09-13.md`, preserving verified database evidence.

Legacy repositories must point back to the canonical project context rather than maintaining divergent copies.

## Database provenance

Current active Supabase project: `ytnmxzzjevdshpbryfyv`.
Historical PUB CORE evidence includes project ref `ilpvxbngblkkfjffkbpq` and a historical `kanban_cards = 244` state. Current verified state is `kanban_cards = 2`. These states must remain provenance-separated.

## Rule for future agents

Before modifying or creating anything named PUB Core, search the GitHub organization first. If the work belongs to the PUB Core platform, modify `pubcore`. Do not create another alias repository.
