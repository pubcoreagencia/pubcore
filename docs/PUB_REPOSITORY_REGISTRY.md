# PUB Repository Registry

**Audit date:** 2026-09-12 23:08 BRT
**Organization:** `pubcoreagencia`
**Inventory:** 53 repositories
**Status:** second-pass provenance audit in progress

## Canonical rule

GitHub is the versioned source of truth for repository identity and code provenance. Repository names alone are never sufficient evidence for merging or deletion. No repository is deleted by this registry.

```text
PUB MASTER MEGA BLASTER CONTEXT
        |
        v
PUB CORE MASTER CONTEXT
        |
        v
PUB CORE (`pubcore`)
   |       |        |        |
   v       v        v        v
Neural    PDL      Ecom     Leads
memory   govern   commerce   CRM
```

## Organization inventory

| # | Repository | Classification | Canonical target | Current action |
|---:|---|---|---|---|
| 1 | `PUB-CORE` | LEGACY / REDIRECT | `pubcore` | No new code |
| 2 | `pubcore` | CANONICAL | `pubcore` | ACTIVE |
| 3 | `pub-core-holding-portal` | HOLDING PORTAL | self | Keep distinct |
| 4 | `pubcoreagencia.github.io` | SITE | self | Verify usage |
| 5 | `PUB-BEATS` | ARCHIVE | self | Already archived |
| 6 | `pub-ecom-landing` | CONSOLIDATED COMPONENT | `pub-ecom/apps/landing` | Verify deployment before archive |
| 7 | `pub-films-landing` | LANDING | `pub-films` | Keep |
| 8 | `pub-agencia-landing` | LANDING | future `pub-agencia` | Keep |
| 9 | `pub-leads` | CANONICAL PRODUCT | `pub-leads` | ACTIVE |
| 10 | `pub3d-landing` | LANDING | `pub-3d` | Verify relationship |
| 11 | `neural-os` | LEGACY / ALIAS CANDIDATE | `pub-neural` | History/deploy audit required |
| 12 | `pubfood-control-growth` | VERTICAL SUBSYSTEM | `pub-food` | Inspect relationship |
| 13 | `pubgrowthai` | RELATED PRODUCT IDENTITY | `pubgrowth-ai-evolution` | Compare history |
| 14 | `pubgrowth-ai-evolution` | PRODUCTION PRODUCT | `pubgrowthai` identity | ACTIVE |
| 15 | `pub-dev-loop` | CANONICAL GOVERNANCE | `pub-dev-loop` | ACTIVE |
| 16 | `pub-ecom` | CANONICAL PRODUCT / MONOREPO | `pub-ecom` | ACTIVE |
| 17 | `pub-dev-loop-template` | TEMPLATE | `pub-dev-loop` | Verify usage |
| 18 | `pub-ops-hub` | OPERATIONS PRODUCT | TBD | Inspect |
| 19 | `pubecomhub` | CONSOLIDATED COMPONENT | `pub-ecom/apps/hub` | Verify deployment before archive |
| 20 | `pub-ecom-catalog-worker` | CONSOLIDATED COMPONENT | `pub-ecom/apps/catalog-worker` | Verify deployment before archive |
| 21 | `pub-shopee-scraper` | INFRA / INGESTION | PUB Ecom ecosystem | Keep separate |
| 22 | `pub-github-mcp` | INFRA / TOOLING | shared infra | Keep separate |
| 23 | `pub-dev-loop-prototypes` | PDL PROTOTYPE | `pub-dev-loop` | Preserve evidence |
| 24 | `pub-9router-cloud` | INFRA / MODEL GATEWAY | shared infra | Keep |
| 25 | `pub-machine` | AUTOMATION ENGINE | Machine family | Inspect |
| 26 | `pub-machine-saas` | MULTI-TENANT VARIANT | Machine family | Inspect |
| 27 | `pub-machine-2` | GENERATION-2 PROTOTYPE | Machine family | Inspect |
| 28 | `leadcore` | LEGACY / ALIAS | `pub-leads` | No new code |
| 29 | `pub-ia` | PLACEHOLDER / EXPERIMENT | Neural/PDL if revived | Inspect |
| 30 | `pub-start` | PLACEHOLDER | TBD | Inspect |
| 31 | `pub-scrapping` | PLACEHOLDER / DATA EXPERIMENT | shared infra | Inspect |
| 32 | `pub-prototype` | PROTOTYPE | PDL/general prototype | Preserve |
| 33 | `pub-neural` | CANONICAL COGNITIVE SYSTEM | `pub-neural` | ACTIVE |
| 34 | `pub-core-os` | LEGACY / GOVERNANCE ALIAS | `pubcore` | No new code |
| 35 | `pub-media` | VERTICAL / MEDIA | self | Keep |
| 36 | `pub-films` | VERTICAL / PRODUCT | `pub-films` | Keep |
| 37 | `pub-lancamentos` | VERTICAL / PRODUCT | `pub-lancamentos` | Keep |
| 38 | `pub-3d` | PRODUCT / 3D | `pub-3d` | Keep |
| 39 | `pub-imoveis` | VERTICAL / REAL ESTATE | `pub-imoveis` | Keep |
| 40 | `pub-bnb` | VERTICAL / HOSPITALITY | `pub-bnb` | Keep |
| 41 | `buzios-de-cima` | LOCAL PRODUCT / MEDIA | self | Verify intent |
| 42 | `pub-records` | VERTICAL / MUSIC | `pub-records` | Keep |
| 43 | `xp-audio-lab` | AUDIO R&D | PUB Records/future lab | Preserve |
| 44 | `pub-games-studio` | VERTICAL / STUDIO | `pub-games-studio` | Keep |
| 45 | `pubet` | VERTICAL / PET | `pubet` | Keep |
| 46 | `pub-food` | VERTICAL / FOOD | `pub-food` | Keep |
| 47 | `pub-crypto` | VERTICAL / CRYPTO | `pub-crypto` | Keep |
| 48 | `ia-pubcrypto` | AI SUBSYSTEM | `pub-crypto` / shared AI | Inspect |
| 49 | `pub-trade` | VERTICAL / TRADING | `pub-trade` | Keep |
| 50 | `pub-textil` | VERTICAL / TEXTILE | `pub-textil` | Keep |
| 51 | `eternize-seu-pinscher` | PRODUCT / CAMPAIGN | `pubet` or independent | Verify |
| 52 | `pub-co` | LEGACY / PORTAL ALIAS | `pubcore` / holding portal | No new core code |
| 53 | `pub-rate-calculator` | UTILITY | shared utility or standalone | Verify ownership |

## Provenance findings, second pass

### PUB Ecom
`pub-ecom` explicitly declares a unified monorepo with `apps/hub`, `apps/catalog-worker` and `apps/landing`, naming `pubecomhub`, `pub-ecom-catalog-worker` and `pub-ecom-landing` as the former projects. The component READMEs independently describe the same Ecom Hub, Catalog Worker and Landing roles. This establishes the intended canonical code boundary as `pub-ecom`.

**Important:** the old Ecom repositories are still receiving commits as of 2026-09-12. Those commits include autonomous-cycle backup snapshots. Therefore they are **not archive-approved yet**. We must verify whether those commits contain live code, only snapshots, or deployment-critical state before archival.

### PUB Growth
`pubgrowth-ai-evolution` contains explicit production metadata including a Cloudflare Workers production URL, Supabase project reference and Banco Inter PIX infrastructure. Its latest commits are from 2026-09-12. `pubgrowthai` also has commits as recent as 2026-09-06. Therefore these cannot be treated as a simple dead-repo duplicate. The next decision must compare ancestry, deployments and production ownership.

### PUB Machine
The READMEs define three different roles: base automation engine, multi-tenant SaaS variant, and second-generation evolution. This is a product family, not proof of three duplicate repositories. No blind merge.

### PUB Core / Leads / Neural aliases
`PUB-CORE` explicitly points to `pubcore` as canonical. `leadcore` is the legacy LeadCore identity while `pub-leads` is the current implementation. `pub-neural` is canonical; `neural-os` remains a provenance candidate because its current default branch has no README.

### Product + presentation pairs
Keep product and presentation layers separate until deployment references are verified:
- `pub-3d` + `pub3d-landing`
- `pub-films` + `pub-films-landing`
- `pub-food` + `pubfood-control-growth`
- `pub-crypto` + `ia-pubcrypto`

## Consolidation clusters

1. `PUB-CORE` + `pub-core-os` + `pub-co` -> central/portal boundary
2. `leadcore` -> `pub-leads`
3. `neural-os` -> `pub-neural`
4. Ecom old repos -> `pub-ecom/apps/*`
5. Machine family -> architecture decision required
6. Growth family -> production identity decision required
7. 3D, Films, Food and Crypto product/subsystem pairs -> dependency checks required

## Archive candidates, NOT approved

`PUB-CORE`, `pub-core-os`, `pub-co`, `leadcore`, `neural-os`, `pubecomhub`, `pub-ecom-catalog-worker`, `pub-ecom-landing`, `pub-machine-2`, `pub-start`, `pub-ia`, `pub-scrapping`, `pub-dev-loop-template`.

No item above may be deleted solely because it appears in this list.

## Required checks before archive/delete

- Git history and ancestry
- latest meaningful commit
- deployment/domain references
- environment variables and external services
- database/schema ownership
- cross-repository imports/references
- active production dependency
- unique assets/data
- whether the supposed canonical repo is actually newer/current

**Rule: never delete first and investigate later.**
