# PUB Repository Registry

**Audit date:** 2026-09-12
**Organization:** `pubcoreagencia`
**Purpose:** canonical inventory, provenance, consolidation and lifecycle control for PUB repositories.

## Governance rule

GitHub is the versioned source of truth for repository identity and code provenance. Repository names alone are never sufficient evidence for merging or deletion. A repository may be classified as legacy, duplicate, product, infrastructure or experiment only after its contents/history/deployment relationships are considered.

**No repository is deleted by this registry.** Archive/delete decisions require a separate provenance and dependency check.

## Canonical architecture

```text
PUB MASTER MEGA BLASTER CONTEXT
        |
        v
PUB CORE MASTER CONTEXT
        |
        v
PUB CORE (`pubcore`)
        |
        +-- PUB Neural (`pub-neural`)       memory/evidence
        +-- PDL (`pub-dev-loop`)             governance/orchestration
        +-- PUB Ecom (`pub-ecom`)             commerce vertical + consolidated ecom apps
        +-- PUB Leads (`pub-leads`)           lead/CRM vertical
        +-- other verticals/products
```

## Full organization inventory

| # | Repository | Classification | Canonical target | Lifecycle action | Confidence |
|---:|---|---|---|---|---|
| 1 | `PUB-CORE` | LEGACY / REDIRECT | `pubcore` | Keep as historical identity; no new code | HIGH |
| 2 | `pubcore` | CANONICAL | `pubcore` | Active central platform | HIGH |
| 3 | `pub-core-holding-portal` | PRODUCT / HOLDING PORTAL | self | Keep distinct; inspect future integration with `pubcore` | MEDIUM |
| 4 | `pubcoreagencia.github.io` | SITE / LANDING | self | Keep if public site is used; otherwise archive later | MEDIUM |
| 5 | `PUB-BEATS` | ARCHIVE | self | Already archived; preserve provenance | HIGH |
| 6 | `pub-ecom-landing` | LEGACY / CONSOLIDATED | `pub-ecom/apps/landing` | Archive after deployment/reference verification | HIGH |
| 7 | `pub-films-landing` | LANDING | `pub-films` | Keep as presentation layer unless later consolidated | MEDIUM |
| 8 | `pub-agencia-landing` | LANDING | `pub-agencia` | Keep as presentation layer | MEDIUM |
| 9 | `pub-leads` | CANONICAL PRODUCT | `pub-leads` | Active | HIGH |
| 10 | `pub3d-landing` | LANDING | `pub-3d` / product TBD | Keep; resolve relationship before archive | MEDIUM |
| 11 | `neural-os` | LEGACY / ALIAS CANDIDATE | `pub-neural` | Do not develop; verify history/deployments before archive | MEDIUM |
| 12 | `pubfood-control-growth` | PRODUCT / VERTICAL | `pub-food` | Inspect before consolidation | MEDIUM |
| 13 | `pubgrowthai` | PRODUCT / VERTICAL | self | Keep until relationship with evolution repo is proven | MEDIUM |
| 14 | `pubgrowth-ai-evolution` | EXPERIMENT / EVOLUTION | `pubgrowthai` or future product | Preserve as experiment; no automatic merge | MEDIUM |
| 15 | `pub-dev-loop` | CANONICAL GOVERNANCE | `pub-dev-loop` | Active PDL | HIGH |
| 16 | `pub-ecom` | CANONICAL PRODUCT / MONOREPO | `pub-ecom` | Active; already consolidates ecom apps | HIGH |
| 17 | `pub-dev-loop-template` | TEMPLATE / INFRA | `pub-dev-loop` | Keep only if used to bootstrap PDL; otherwise archive | MEDIUM |
| 18 | `pub-ops-hub` | PRODUCT / OPERATIONS | `pubcore` / PDL integration TBD | Inspect; do not merge by name | LOW |
| 19 | `pubecomhub` | LEGACY / CONSOLIDATED | `pub-ecom/apps/hub` | Archive after reference verification | HIGH |
| 20 | `pub-ecom-catalog-worker` | LEGACY / CONSOLIDATED | `pub-ecom/apps/catalog-worker` | Archive after deployment/reference verification | HIGH |
| 21 | `pub-shopee-scraper` | INFRA / DATA INGESTION | `pub-ecom` or infra future | Keep separate until worker architecture absorbs it | MEDIUM |
| 22 | `pub-github-mcp` | INFRA / DEVELOPER TOOLING | PDL / shared infra | Keep separate unless formally consolidated | MEDIUM |
| 23 | `pub-dev-loop-prototypes` | PROTOTYPE / PDL SUBSYSTEM | `pub-dev-loop` | Preserve as prototype evidence; consolidate only after dependency check | HIGH |
| 24 | `pub-9router-cloud` | INFRA / MODEL GATEWAY | shared infra / PDL | Keep as infrastructure component | HIGH |
| 25 | `pub-machine` | EXPERIMENT / PLACEHOLDER | TBD | Inspect contents before lifecycle decision | MEDIUM |
| 26 | `pub-machine-saas` | EXPERIMENT / PLACEHOLDER | TBD | Inspect contents before lifecycle decision | MEDIUM |
| 27 | `pub-machine-2` | PROTOTYPE / DUPLICATE CANDIDATE | `pub-machine` | Inspect; likely archive candidate if empty | HIGH |
| 28 | `leadcore` | LEGACY / ALIAS | `pub-leads` | Do not develop; preserve identity until deployment/reference audit | HIGH |
| 29 | `pub-ia` | PLACEHOLDER / EXPERIMENT | PUB Neural / PDL if revived | Inspect; no canonical product status | MEDIUM |
| 30 | `pub-start` | PLACEHOLDER / PROTOTYPE | TBD | Inspect; archive candidate if unused | HIGH |
| 31 | `pub-scrapping` | PLACEHOLDER / EXPERIMENT | shared data infra | Inspect; no active canonical role established | MEDIUM |
| 32 | `pub-prototype` | PROTOTYPE | PDL prototype system | Preserve as historical/prototype evidence | HIGH |
| 33 | `pub-neural` | CANONICAL COGNITIVE SYSTEM | `pub-neural` | Active | HIGH |
| 34 | `pub-core-os` | LEGACY / GOVERNANCE ALIAS | `pubcore` | No new code; preserve provenance | HIGH |
| 35 | `pub-media` | VERTICAL / MEDIA | self | Keep as vertical placeholder/product | MEDIUM |
| 36 | `pub-films` | VERTICAL / PRODUCT | `pub-films` | Keep distinct from landing | HIGH |
| 37 | `pub-lancamentos` | VERTICAL / PRODUCT | `pub-lancamentos` | Keep distinct | HIGH |
| 38 | `pub-3d` | PRODUCT / 3D | `pub-3d` | Keep; inspect relationship to landing | HIGH |
| 39 | `pub-imoveis` | VERTICAL / REAL ESTATE | `pub-imoveis` | Keep distinct | HIGH |
| 40 | `pub-bnb` | VERTICAL / HOSPITALITY | `pub-bnb` | Keep distinct | HIGH |
| 41 | `buzios-de-cima` | LOCAL / MEDIA / PRODUCT | self | Keep until product intent is verified | LOW |
| 42 | `pub-records` | VERTICAL / MUSIC | `pub-records` | Keep distinct | HIGH |
| 43 | `xp-audio-lab` | EXPERIMENT / AUDIO R&D | PUB Records / future audio lab | Preserve as experiment | HIGH |
| 44 | `pub-games-studio` | VERTICAL / STUDIO | `pub-games-studio` | Keep distinct | HIGH |
| 45 | `pubet` | VERTICAL / PET | `pubet` | Keep distinct | MEDIUM |
| 46 | `pub-food` | VERTICAL / FOOD | `pub-food` | Keep; investigate relationship with `pubfood-control-growth` | HIGH |
| 47 | `pub-crypto` | VERTICAL / CRYPTO | `pub-crypto` | Keep as product identity; inspect relation to `ia-pubcrypto` | HIGH |
| 48 | `ia-pubcrypto` | EXPERIMENT / AI CRYPTO | `pub-crypto` or shared AI infra | Consolidation candidate after provenance review | MEDIUM |
| 49 | `pub-trade` | VERTICAL / TRADING | `pub-trade` | Keep distinct | HIGH |
| 50 | `pub-textil` | VERTICAL / TEXTILE | `pub-textil` | Keep distinct | HIGH |
| 51 | `eternize-seu-pinscher` | PRODUCT / CAMPAIGN | `pubet` or independent product | Verify product ownership/relationship before merge | MEDIUM |
| 52 | `pub-co` | LEGACY / PORTAL ALIAS | `pubcore` / holding portal | Preserve as historical identity; no new core code | HIGH |
| 53 | `pub-rate-calculator` | UTILITY / PRODUCT | shared utility or standalone | Keep until product ownership is decided | HIGH |

## Confirmed consolidation evidence

### PUB Ecom
`pub-ecom` explicitly states that it consolidates the E-commerce ecosystem and includes the Hub, Catalog Worker and Landing under `apps/`. Therefore `pubecomhub`, `pub-ecom-catalog-worker` and `pub-ecom-landing` are legacy/consolidated repositories, not independent canonical products. Verify external deployment references before archiving them.

### PUB Leads
`pub-leads` is the current B2B prospecting/CRM SaaS. `leadcore` is a legacy identity and must not become a second active implementation. Existing deployment evidence has already linked the historical LeadCore/leadcore naming to PUB Leads.

### PUB Core
`pubcore` is the canonical central platform. `PUB-CORE` explicitly redirects to it. `pub-core-os` and `pub-co` are historical governance/portal identities and should remain provenance records until all external references are checked.

### PUB Neural
`pub-neural` is the canonical cognitive/memory system. `neural-os` is a legacy naming candidate and must not be treated as a second active Neural implementation without evidence.

## Duplicate / consolidation clusters requiring dependency checks

1. `PUB-CORE` + `pub-core-os` + `pub-co` -> `pubcore`
2. `leadcore` -> `pub-leads`
3. `neural-os` -> `pub-neural`
4. `pub-ecom-landing` + `pubecomhub` + `pub-ecom-catalog-worker` -> `pub-ecom/apps/*`
5. `pub3d-landing` + `pub-3d` -> determine product vs presentation layer
6. `pub-food` + `pubfood-control-growth` -> determine product vs growth/control subsystem
7. `pub-crypto` + `ia-pubcrypto` -> determine product vs AI subsystem
8. `pub-machine` + `pub-machine-saas` + `pub-machine-2` -> inspect before any merge/archive
9. `pubgrowthai` + `pubgrowth-ai-evolution` -> product vs experimental evolution
10. `pub-films` + `pub-films-landing` -> product vs presentation layer
11. `pub-agencia-landing` + future `pub-agencia` identity -> presentation layer, if/when canonical app exists

## Next audit pass

Before any archive/delete action, inspect for each consolidation cluster:
- README / MASTER_CONTEXT
- git history and latest meaningful commit
- deployment references
- environment variables and external services
- database/schema ownership
- imports/references from other PUB repositories
- domain/URL usage
- active production dependency
- unique assets/data that must be preserved

Only then move a repository to `ARCHIVE APPROVED`.
